import { PoolClient } from 'pg';
import { TxManager } from '../../database/tx-manager';
import { Qty } from '../../types';

export interface RecordDefectDto {
  defectTypeId: number;
  severity: 'minor' | 'major' | 'critical';
  defectCount?: number;
  positionNote?: string;
}

export interface RecordInspectionDto {
  rollCode: string;
  inspectorId: number;
  result: 'passed' | 'rework' | 'rejected';
  remarks?: string;
  defects?: RecordDefectDto[];
}

export interface ShelfInventoryQuery {
  shelfLocation?: string;
  productName?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class QualityService {
  /**
   * Fetch Roll details, specifications, and full inspection attempt history by Roll Code
   */
  static async getRollByCode(rollCode: string): Promise<any> {
    const roll = await TxManager.queryOne<any>(
      `SELECT fr.roll_id, fr.roll_code, fr.job_id, pj.job_no,
              co.order_id, co.order_no, b.name AS buyer_name,
              fp.product_id, fp.name AS fabric_product_name,
              c.colour_id, c.name AS colour_name,
              u.unit_code, fr.length_m, fr.weight_kg, fr.status AS roll_status,
              fr.shelf_location, fr.version, fr.created_at AS manufactured_at,
              emp_op.employee_id AS operator_id, emp_op.full_name AS operator_name,
              m.machine_code, ps.name AS process_stage_name
         FROM fabric_roll fr
         JOIN production_job pj ON fr.job_id = pj.job_id
         JOIN machine m ON pj.machine_id = m.machine_id
         JOIN process_stage ps ON m.stage_id = ps.stage_id
         JOIN order_item oi ON pj.order_item_id = oi.order_item_id
         JOIN customer_order co ON oi.order_id = co.order_id
         JOIN buyer b ON co.buyer_id = b.buyer_id
         JOIN fabric_product fp ON oi.product_id = fp.product_id
         JOIN colour c ON oi.colour_id = c.colour_id
         JOIN unit_of_measure u ON fp.unit_id = u.unit_id
    LEFT JOIN employee emp_op ON fr.operator_id = emp_op.employee_id
        WHERE fr.roll_code = $1`,
      [rollCode.trim().toUpperCase()]
    );

    if (!roll) {
      throw new Error('ROLL_NOT_FOUND');
    }

    // Fetch all inspection attempts
    const inspections = await TxManager.query<any>(
      `SELECT qi.inspection_id, qi.roll_id, qi.attempt_no, qi.result,
              qi.inspected_at, qi.remarks, qi.inspector_id,
              emp.full_name AS inspector_name, u.username AS recorded_by_username,
              qi.created_at
         FROM qc_inspection qi
         JOIN employee emp ON qi.inspector_id = emp.employee_id
    LEFT JOIN app_user u ON qi.created_by = u.user_id
        WHERE qi.roll_id = $1
        ORDER BY qi.attempt_no ASC`,
      [roll.roll_id]
    );

    // Fetch all defects associated with these inspections
    const defects = await TxManager.query<any>(
      `SELECT qd.defect_id, qd.inspection_id, qd.defect_type_id,
              dt.name AS defect_type_name, qd.severity, qd.defect_count,
              qd.position_note, qd.created_at
         FROM qc_defect qd
         JOIN defect_type dt ON qd.defect_type_id = dt.defect_type_id
        WHERE qd.inspection_id IN (
          SELECT inspection_id FROM qc_inspection WHERE roll_id = $1
        )
        ORDER BY qd.defect_id ASC`,
      [roll.roll_id]
    );

    return {
      ...roll,
      inspections: inspections.map(ins => ({
        ...ins,
        defects: defects.filter(d => d.inspection_id === ins.inspection_id),
      })),
    };
  }

  /**
   * WF-7: Record QC Inspection & Defect Incident Logging
   * Atomically transitions fabric_roll status to 'in_stock', 'rework', or 'rejected' via trg_qc_before.
   */
  static async recordInspection(
    dto: RecordInspectionDto,
    userId: number
  ): Promise<{ inspection: any; roll: any; defects: any[] }> {
    // 1. Business Logic Invariant: A roll cannot pass inspection if a critical defect is found
    if (dto.result === 'passed' && dto.defects && dto.defects.some(d => d.severity === 'critical')) {
      throw new Error('CRITICAL_DEFECT_NOT_PASSABLE: A roll with critical defects cannot be marked as passed.');
    }

    // 2. Business Logic Invariant: Rework or Rejected results must record defects
    if ((dto.result === 'rework' || dto.result === 'rejected') && (!dto.defects || dto.defects.length === 0)) {
      throw new Error('DEFECT_REQUIRED_FOR_NON_PASS: Inspection with rework or rejected outcome requires at least one defect.');
    }

    return await TxManager.withTransaction(
      {
        userId,
        source: 'QC_INSPECTION',
        reason: `Record QC inspection for roll ${dto.rollCode} result: ${dto.result}`,
      },
      async (client: PoolClient) => {
        // 3. Lock and verify fabric_roll
        const rollRes = await client.query(
          `SELECT roll_id, roll_code, status, version 
             FROM fabric_roll 
            WHERE roll_code = $1 
              FOR UPDATE`,
          [dto.rollCode.trim().toUpperCase()]
        );

        if (rollRes.rowCount === 0) {
          throw new Error('ROLL_NOT_FOUND');
        }

        const roll = rollRes.rows[0];

        if (roll.status !== 'pending_qc') {
          throw new Error(`ROLL_NOT_AWAITING_QC: Roll ${dto.rollCode} has status "${roll.status}". Only rolls in "pending_qc" can be inspected.`);
        }

        // 4. Verify Inspector Employee
        const inspectorRes = await client.query(
          `SELECT employee_id, full_name, is_active FROM employee WHERE employee_id = $1`,
          [dto.inspectorId]
        );
        if (inspectorRes.rowCount === 0) {
          throw new Error('INSPECTOR_NOT_FOUND');
        }
        if (!inspectorRes.rows[0].is_active) {
          throw new Error('INSPECTOR_INACTIVE: The inspector employee account is deactivated.');
        }

        // 5. Insert qc_inspection
        // This fires trg_qc_before which auto-increments attempt_no and updates fabric_roll.status
        const insRes = await client.query(
          `INSERT INTO qc_inspection (
             roll_id, inspector_id, result, remarks
           ) VALUES (
             $1, $2, $3, $4
           ) RETURNING inspection_id, roll_id, inspector_id, attempt_no, result, inspected_at, remarks, created_at`,
          [
            roll.roll_id,
            dto.inspectorId,
            dto.result,
            dto.remarks ? dto.remarks.trim() : null,
          ]
        );

        const newInspection = insRes.rows[0];
        const createdDefects: any[] = [];

        // 6. Insert qc_defect entries (if any)
        if (dto.defects && dto.defects.length > 0) {
          for (const d of dto.defects) {
            // Verify defect_type
            const dtCheck = await client.query(
              `SELECT defect_type_id FROM defect_type WHERE defect_type_id = $1`,
              [d.defectTypeId]
            );
            if (dtCheck.rowCount === 0) {
              throw new Error(`DEFECT_TYPE_NOT_FOUND: Defect type ID ${d.defectTypeId} does not exist.`);
            }

            const defectRes = await client.query(
              `INSERT INTO qc_defect (
                 inspection_id, defect_type_id, severity, defect_count, position_note
               ) VALUES (
                 $1, $2, $3, $4, $5
               ) RETURNING defect_id, inspection_id, defect_type_id, severity, defect_count, position_note, created_at`,
              [
                newInspection.inspection_id,
                d.defectTypeId,
                d.severity,
                d.defectCount || 1,
                d.positionNote ? d.positionNote.trim() : null,
              ]
            );

            createdDefects.push(defectRes.rows[0]);
          }
        }

        // 7. Retrieve updated roll status
        const updatedRollRes = await client.query(
          `SELECT roll_id, roll_code, status, shelf_location, version, updated_at FROM fabric_roll WHERE roll_id = $1`,
          [roll.roll_id]
        );

        return {
          inspection: newInspection,
          roll: updatedRollRes.rows[0],
          defects: createdDefects,
        };
      }
    );
  }

  /**
   * Mark Roll as Scrapped
   */
  static async scrapRoll(rollId: number, reason: string, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'ROLL_SCRAP',
        reason: `Scrap roll ID: ${rollId}. Reason: ${reason}`,
      },
      async (client: PoolClient) => {
        const rollRes = await client.query(
          `SELECT roll_id, roll_code, status, version 
             FROM fabric_roll 
            WHERE roll_id = $1 
              FOR UPDATE`,
          [rollId]
        );

        if (rollRes.rowCount === 0) {
          throw new Error('ROLL_NOT_FOUND');
        }

        const roll = rollRes.rows[0];

        if (roll.status === 'scrapped') {
          throw new Error('ROLL_ALREADY_SCRAPPED');
        }
        if (roll.status === 'loaded' || roll.status === 'dispatched') {
          throw new Error(`CANNOT_SCRAP_DISPATCHED_ROLL: Roll status is "${roll.status}". Dispatched or loaded rolls cannot be scrapped.`);
        }

        const updatedRes = await client.query(
          `UPDATE fabric_roll 
              SET status = 'scrapped',
                  version = version + 1,
                  updated_at = now()
            WHERE roll_id = $1
        RETURNING roll_id, roll_code, status, version, updated_at`,
          [rollId]
        );

        return updatedRes.rows[0];
      }
    );
  }

  /**
   * Complete Traceability Dossier Genealogy (reads from view v_roll_trace)
   */
  static async getRollTrace(rollCode: string): Promise<any> {
    const trace = await TxManager.queryOne<any>(
      `SELECT * FROM v_roll_trace WHERE roll_code = $1`,
      [rollCode.trim().toUpperCase()]
    );

    if (!trace) {
      throw new Error('ROLL_NOT_FOUND');
    }

    return trace;
  }

  /**
   * Defect Analytics by Machine (reads from view v_defects_by_machine)
   */
  static async getDefectAnalyticsMachines(): Promise<any[]> {
    return await TxManager.query<any>(
      `SELECT * FROM v_defects_by_machine ORDER BY total_defects_count DESC, machine_code ASC`
    );
  }

  /**
   * Defect Analytics by Operator (reads from view v_defects_by_operator)
   */
  static async getDefectAnalyticsOperators(): Promise<any[]> {
    return await TxManager.query<any>(
      `SELECT * FROM v_defects_by_operator ORDER BY total_defects_count DESC, operator_name ASC`
    );
  }

  /**
   * Shelf Inventory of Inspected Rolls Ready for Dispatch (status = 'in_stock')
   */
  static async getShelfInventory(query: ShelfInventoryQuery): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 25));
    const offset = (page - 1) * limit;

    const conditions: string[] = [`fr.status = 'in_stock'`];
    const values: any[] = [];
    let paramIdx = 1;

    if (query.shelfLocation) {
      conditions.push(`fr.shelf_location ILIKE $${paramIdx++}`);
      values.push(`%${query.shelfLocation.trim()}%`);
    }
    if (query.productName) {
      conditions.push(`fp.name ILIKE $${paramIdx++}`);
      values.push(`%${query.productName.trim()}%`);
    }
    if (query.search) {
      conditions.push(`(fr.roll_code ILIKE $${paramIdx} OR co.order_no ILIKE $${paramIdx} OR b.name ILIKE $${paramIdx})`);
      values.push(`%${query.search.trim()}%`);
      paramIdx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await TxManager.queryOne<{ count: string }>(
      `SELECT count(*) as count 
         FROM fabric_roll fr
         JOIN production_job pj ON fr.job_id = pj.job_id
         JOIN order_item oi ON pj.order_item_id = oi.order_item_id
         JOIN customer_order co ON oi.order_id = co.order_id
         JOIN buyer b ON co.buyer_id = b.buyer_id
         JOIN fabric_product fp ON oi.product_id = fp.product_id
       ${whereClause}`,
      values
    );
    const total = parseInt(countRes?.count || '0', 10);

    const rows = await TxManager.query<any>(
      `SELECT fr.roll_id, fr.roll_code, fr.length_m, fr.weight_kg, fr.shelf_location,
              fr.created_at AS manufactured_at, fp.name AS fabric_product_name,
              c.name AS colour_name, co.order_no, b.name AS buyer_name,
              m.machine_code, pj.job_no
         FROM fabric_roll fr
         JOIN production_job pj ON fr.job_id = pj.job_id
         JOIN machine m ON pj.machine_id = m.machine_id
         JOIN order_item oi ON pj.order_item_id = oi.order_item_id
         JOIN customer_order co ON oi.order_id = co.order_id
         JOIN buyer b ON co.buyer_id = b.buyer_id
         JOIN fabric_product fp ON oi.product_id = fp.product_id
         JOIN colour c ON oi.colour_id = c.colour_id
       ${whereClause}
        ORDER BY fr.roll_id DESC
        LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...values, limit, offset]
    );

    return {
      data: rows,
      total,
      page,
      limit,
    };
  }
}
