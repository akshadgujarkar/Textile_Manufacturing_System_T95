import { PoolClient } from 'pg';
import { TxManager } from '../../database/tx-manager';
import { v4 as uuidv4 } from 'uuid';
import { Qty } from '../../types';

export interface CreateJobDto {
  orderItemId: number;
  stageId: number;
  machineId: number;
  plannedQty: number;
}

export interface LogShiftOutputDto {
  jobId: number;
  shiftId: number;
  operatorId?: number;
  outputQty: number;
  clientRequestId: string;
  generateFabricRoll?: boolean;
  rollWeightKg?: number;
  shelfLocation?: string;
}

export interface RecordBreakdownDto {
  note: string;
  reportedBy?: number;
}

export interface ListJobsQuery {
  jobStatus?: string;
  machineCode?: string;
  orderNo?: string;
  page?: number;
  limit?: number;
}

export interface ShiftOutputQuery {
  productionDate?: string;
  shiftId?: number;
  machineId?: number;
}

export class ProductionService {
  /**
   * Schedule a new Production Job for an Order Item
   * Roles: production_manager, admin, owner
   */
  static async createJob(
    dto: CreateJobDto,
    userId: number
  ): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'JOB_CREATE',
        reason: `Create production job for order item ID: ${dto.orderItemId} on machine: ${dto.machineId}`,
      },
      async (client: PoolClient) => {
        // 1. Verify Order Item and confirmed order status
        const itemRes = await client.query(
          `SELECT oi.order_item_id, oi.ordered_qty, co.status AS order_status, co.order_no
             FROM order_item oi
             JOIN customer_order co ON oi.order_id = co.order_id
            WHERE oi.order_item_id = $1`,
          [dto.orderItemId]
        );

        if (itemRes.rowCount === 0) {
          throw new Error('ORDER_ITEM_NOT_FOUND');
        }

        if (itemRes.rows[0].order_status !== 'confirmed') {
          throw new Error(`ORDER_NOT_CONFIRMED: Order status is "${itemRes.rows[0].order_status}". Only confirmed orders can be scheduled.`);
        }

        // 2. Verify Machine matches Stage (enforces fk_job_machine_stage)
        const machineRes = await client.query(
          `SELECT machine_id, stage_id, machine_code, is_active 
             FROM machine 
            WHERE machine_id = $1 AND stage_id = $2`,
          [dto.machineId, dto.stageId]
        );

        if (machineRes.rowCount === 0) {
          throw new Error('MACHINE_STAGE_MISMATCH: Selected machine does not belong to the specified process stage.');
        }

        if (!machineRes.rows[0].is_active) {
          throw new Error('MACHINE_INACTIVE: The selected machine is currently deactivated.');
        }

        // 3. Insert Job in 'planned' status
        const jobRes = await client.query(
          `INSERT INTO production_job (
             order_item_id, stage_id, machine_id, planned_qty, status, version
           ) VALUES (
             $1, $2, $3, $4, 'planned', 1
           ) RETURNING job_id, job_no, order_item_id, stage_id, machine_id, 
                       planned_qty, status, version, created_at, created_by`,
          [dto.orderItemId, dto.stageId, dto.machineId, dto.plannedQty]
        );

        return jobRes.rows[0];
      }
    );
  }

  /**
   * WF-4: Start Production Job
   * Transitions job to 'running' and updates machine state to 'running'.
   * Database trigger trg_job_machine_events automatically manages machine_status_event.
   */
  static async startJob(jobId: number, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'JOB_START',
        reason: `Start production job ID: ${jobId}`,
      },
      async (client: PoolClient) => {
        // 1. Lock and retrieve job
        const jobRes = await client.query(
          `SELECT job_id, job_no, machine_id, status, version 
             FROM production_job 
            WHERE job_id = $1 
              FOR UPDATE`,
          [jobId]
        );

        if (jobRes.rowCount === 0) {
          throw new Error('JOB_NOT_FOUND');
        }

        const job = jobRes.rows[0];

        if (job.status === 'running') {
          throw new Error('JOB_ALREADY_RUNNING');
        }
        if (job.status === 'completed') {
          throw new Error('JOB_ALREADY_COMPLETED');
        }
        if (job.status === 'cancelled') {
          throw new Error('JOB_CANCELLED');
        }

        // 2. Check if another job is currently running on this machine (enforced by uq_job_one_running_per_machine)
        const busyCheck = await client.query(
          `SELECT job_id, job_no FROM production_job WHERE machine_id = $1 AND status = 'running'`,
          [job.machine_id]
        );
        if (busyCheck.rowCount && busyCheck.rowCount > 0) {
          throw new Error(`MACHINE_BUSY: Machine is currently running job ${busyCheck.rows[0].job_no}`);
        }

        // 3. Transition Job to 'running'
        // This fires trg_job_before (sets started_at = now()) and trg_job_machine_events (opens running status event)
        const updatedRes = await client.query(
          `UPDATE production_job 
              SET status = 'running',
                  started_at = COALESCE(started_at, now()),
                  version = version + 1,
                  updated_at = now()
            WHERE job_id = $1
        RETURNING job_id, job_no, machine_id, status, started_at, version, updated_at`,
          [jobId]
        );

        return updatedRes.rows[0];
      }
    );
  }

  /**
   * Complete Production Job
   * Transitions job to 'completed' and sets machine state back to 'idle'.
   */
  static async completeJob(jobId: number, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'JOB_COMPLETE',
        reason: `Complete production job ID: ${jobId}`,
      },
      async (client: PoolClient) => {
        const jobRes = await client.query(
          `SELECT job_id, job_no, machine_id, status, version 
             FROM production_job 
            WHERE job_id = $1 
              FOR UPDATE`,
          [jobId]
        );

        if (jobRes.rowCount === 0) {
          throw new Error('JOB_NOT_FOUND');
        }

        const job = jobRes.rows[0];

        if (job.status !== 'running' && job.status !== 'interrupted') {
          throw new Error(`INVALID_JOB_STATUS: Cannot complete a job with status "${job.status}"`);
        }

        // Transition Job to 'completed'
        // Fires trg_job_before (sets ended_at = now()) and trg_job_machine_events (closes running status event and sets machine to idle)
        const updatedRes = await client.query(
          `UPDATE production_job 
              SET status = 'completed',
                  ended_at = now(),
                  version = version + 1,
                  updated_at = now()
            WHERE job_id = $1
        RETURNING job_id, job_no, machine_id, status, started_at, ended_at, version, updated_at`,
          [jobId]
        );

        return updatedRes.rows[0];
      }
    );
  }

  /**
   * WF-5: Log Shift Output & Optionally Generate Fabric Roll (Pending QC)
   * Append-only ledger with client_request_id idempotency.
   */
  static async logShiftOutput(
    dto: LogShiftOutputDto,
    userId: number
  ): Promise<{ log: any; roll?: any; isIdempotentRetry: boolean }> {
    // 1. Check idempotency: If client_request_id already exists in production_log, return existing record
    const existingLog = await TxManager.queryOne<any>(
      `SELECT log_id, job_id, shift_id, operator_id, output_qty, logged_at, client_request_id, created_at, created_by 
         FROM production_log 
        WHERE client_request_id = $1`,
      [dto.clientRequestId]
    );

    if (existingLog) {
      const existingRoll = await TxManager.queryOne<any>(
        `SELECT roll_id, roll_code, job_id, length_m, weight_kg, status, shelf_location, created_at 
           FROM fabric_roll 
          WHERE client_request_id = $1`,
        [dto.clientRequestId]
      );

      return {
        log: existingLog,
        roll: existingRoll || undefined,
        isIdempotentRetry: true,
      };
    }

    // 2. Perform Atomic Shift Output & Roll Generation
    return await TxManager.withTransaction(
      {
        userId,
        source: 'SHIFT_OUTPUT_LOG',
        reason: `Log shift output ${dto.outputQty} for job ID: ${dto.jobId}`,
      },
      async (client: PoolClient) => {
        // Validate Job Status: Output can only be logged for running jobs
        const jobRes = await client.query(
          `SELECT job_id, status, machine_id FROM production_job WHERE job_id = $1`,
          [dto.jobId]
        );
        if (jobRes.rowCount === 0) {
          throw new Error('JOB_NOT_FOUND');
        }
        if (jobRes.rows[0].status !== 'running') {
          throw new Error(`JOB_NOT_RUNNING: Job is currently "${jobRes.rows[0].status}". Output can only be logged against running jobs.`);
        }

        // Validate Shift
        const shiftRes = await client.query(`SELECT shift_id, name FROM shift WHERE shift_id = $1`, [dto.shiftId]);
        if (shiftRes.rowCount === 0) {
          throw new Error('SHIFT_NOT_FOUND');
        }

        // Validate Operator if provided
        if (dto.operatorId) {
          const empRes = await client.query(`SELECT employee_id FROM employee WHERE employee_id = $1`, [dto.operatorId]);
          if (empRes.rowCount === 0) {
            throw new Error('OPERATOR_NOT_FOUND');
          }
        }

        // Insert append-only production_log entry
        const logRes = await client.query(
          `INSERT INTO production_log (
             job_id, shift_id, operator_id, output_qty, client_request_id
           ) VALUES (
             $1, $2, $3, $4, $5
           ) RETURNING log_id, job_id, shift_id, operator_id, output_qty, logged_at, client_request_id, created_at`,
          [
            dto.jobId,
            dto.shiftId,
            dto.operatorId || null,
            dto.outputQty,
            dto.clientRequestId,
          ]
        );

        const newLog = logRes.rows[0];
        let newRoll: any = undefined;

        // Optionally generate fabric roll in 'pending_qc' status
        if (dto.generateFabricRoll) {
          const rollRes = await client.query(
            `INSERT INTO fabric_roll (
               job_id, client_request_id, operator_id, length_m, weight_kg, status, shelf_location, version
             ) VALUES (
               $1, $2, $3, $4, $5, 'pending_qc', $6, 1
             ) RETURNING roll_id, roll_code, job_id, operator_id, length_m, weight_kg, status, shelf_location, created_at`,
            [
              dto.jobId,
              dto.clientRequestId, // Links roll directly to the idempotent request
              dto.operatorId || null,
              dto.outputQty,
              dto.rollWeightKg || null,
              dto.shelfLocation ? dto.shelfLocation.trim() : null,
            ]
          );
          newRoll = rollRes.rows[0];
        }

        return {
          log: newLog,
          roll: newRoll,
          isIdempotentRetry: false,
        };
      }
    );
  }

  /**
   * WF-6: Record Machine Breakdown / Downtime Event
   * Interrupts running job and opens 'breakdown' event on machine_status_event.
   */
  static async recordBreakdown(
    machineId: number,
    dto: RecordBreakdownDto,
    userId: number
  ): Promise<{ machineEvent: any; interruptedJob?: any }> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'MACHINE_BREAKDOWN',
        reason: `Record machine breakdown on machine ID: ${machineId}: ${dto.note}`,
      },
      async (client: PoolClient) => {
        // 1. Verify Machine exists
        const machineRes = await client.query(
          `SELECT machine_id, machine_code FROM machine WHERE machine_id = $1`,
          [machineId]
        );
        if (machineRes.rowCount === 0) {
          throw new Error('MACHINE_NOT_FOUND');
        }

        // 2. Find and interrupt any running job on this machine
        let interruptedJob: any = undefined;
        const runningJobRes = await client.query(
          `SELECT job_id, job_no, status, version 
             FROM production_job 
            WHERE machine_id = $1 AND status = 'running' 
              FOR UPDATE`,
          [machineId]
        );

        if (runningJobRes.rowCount && runningJobRes.rowCount > 0) {
          const job = runningJobRes.rows[0];
          const updJob = await client.query(
            `UPDATE production_job 
                SET status = 'interrupted',
                    version = version + 1,
                    updated_at = now()
              WHERE job_id = $1
          RETURNING job_id, job_no, machine_id, status, version, updated_at`,
            [job.job_id]
          );
          interruptedJob = updJob.rows[0];
        }

        // 3. Close current open machine status event
        const openEventRes = await client.query(
          `SELECT event_id, state FROM machine_status_event WHERE machine_id = $1 AND ended_at IS NULL FOR UPDATE`,
          [machineId]
        );

        if (openEventRes.rowCount && openEventRes.rowCount > 0) {
          await client.query(
            `UPDATE machine_status_event SET ended_at = now() WHERE event_id = $1`,
            [openEventRes.rows[0].event_id]
          );
        }

        // 4. Open new 'breakdown' status event
        const newEventRes = await client.query(
          `INSERT INTO machine_status_event (
             machine_id, state, started_at, note, reported_by
           ) VALUES (
             $1, 'breakdown', now(), $2, $3
           ) RETURNING event_id, machine_id, state, started_at, ended_at, note, reported_by, created_at`,
          [machineId, dto.note.trim(), dto.reportedBy || null]
        );

        return {
          machineEvent: newEventRes.rows[0],
          interruptedJob,
        };
      }
    );
  }

  /**
   * Resolve Machine Downtime
   * Closes breakdown/maintenance event and transitions machine to 'idle'.
   */
  static async resolveDowntime(
    machineId: number,
    note: string | undefined,
    userId: number
  ): Promise<{ resolvedEvent: any; newIdleEvent: any }> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'RESOLVE_DOWNTIME',
        reason: `Resolve downtime on machine ID: ${machineId}`,
      },
      async (client: PoolClient) => {
        // 1. Close current open breakdown/maintenance event
        const openEventRes = await client.query(
          `SELECT event_id, state FROM machine_status_event WHERE machine_id = $1 AND ended_at IS NULL FOR UPDATE`,
          [machineId]
        );

        if (openEventRes.rowCount === 0) {
          throw new Error('NO_OPEN_DOWNTIME_EVENT: Machine has no ongoing downtime event to resolve.');
        }

        const openEvent = openEventRes.rows[0];
        const closedRes = await client.query(
          `UPDATE machine_status_event SET ended_at = now() WHERE event_id = $1 RETURNING *`,
          [openEvent.event_id]
        );

        // 2. Open new 'idle' event
        const idleRes = await client.query(
          `INSERT INTO machine_status_event (
             machine_id, state, started_at, note
           ) VALUES (
             $1, 'idle', now(), $2
           ) RETURNING event_id, machine_id, state, started_at, ended_at, note, created_at`,
          [machineId, note ? note.trim() : 'Downtime resolved. Machine is now idle and ready for production.']
        );

        return {
          resolvedEvent: closedRes.rows[0],
          newIdleEvent: idleRes.rows[0],
        };
      }
    );
  }

  /**
   * Reassign Interrupted Job to an Available Machine of the same stage
   */
  static async reassignInterruptedJob(
    jobId: number,
    newMachineId: number,
    userId: number
  ): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'JOB_REASSIGN',
        reason: `Reassign job ID: ${jobId} to new machine ID: ${newMachineId}`,
      },
      async (client: PoolClient) => {
        // 1. Lock and verify job
        const jobRes = await client.query(
          `SELECT job_id, job_no, stage_id, machine_id, status, version 
             FROM production_job 
            WHERE job_id = $1 
              FOR UPDATE`,
          [jobId]
        );

        if (jobRes.rowCount === 0) {
          throw new Error('JOB_NOT_FOUND');
        }

        const job = jobRes.rows[0];

        if (job.status !== 'interrupted' && job.status !== 'planned') {
          throw new Error(`INVALID_JOB_STATUS: Only planned or interrupted jobs can be reassigned. Current status is "${job.status}".`);
        }

        // 2. Verify new machine belongs to the same stage
        const targetMachine = await client.query(
          `SELECT machine_id, stage_id, machine_code, is_active FROM machine WHERE machine_id = $1 AND stage_id = $2`,
          [newMachineId, job.stage_id]
        );

        if (targetMachine.rowCount === 0) {
          throw new Error('MACHINE_STAGE_MISMATCH: The target machine does not belong to the job stage.');
        }

        if (!targetMachine.rows[0].is_active) {
          throw new Error('MACHINE_INACTIVE: The target machine is deactivated.');
        }

        // 3. Update machine on the job
        const updatedRes = await client.query(
          `UPDATE production_job 
              SET machine_id = $1,
                  version = version + 1,
                  updated_at = now()
            WHERE job_id = $2
        RETURNING job_id, job_no, stage_id, machine_id, status, version, updated_at`,
          [newMachineId, jobId]
        );

        return updatedRes.rows[0];
      }
    );
  }

  /**
   * Live Production Floor Matrix (reads from view v_machine_status)
   */
  static async getFloorMatrix(): Promise<any[]> {
    return await TxManager.query<any>(
      `SELECT * FROM v_machine_status ORDER BY process_stage_name ASC, machine_code ASC`
    );
  }

  /**
   * Production Job Progress List (reads from view v_job_progress)
   */
  static async getJobProgress(query: ListJobsQuery): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (query.jobStatus) {
      conditions.push(`job_status = $${paramIdx++}`);
      values.push(query.jobStatus);
    }
    if (query.machineCode) {
      conditions.push(`machine_code ILIKE $${paramIdx++}`);
      values.push(`%${query.machineCode.trim()}%`);
    }
    if (query.orderNo) {
      conditions.push(`order_no ILIKE $${paramIdx++}`);
      values.push(`%${query.orderNo.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await TxManager.queryOne<{ count: string }>(
      `SELECT count(*) as count FROM v_job_progress ${whereClause}`,
      values
    );
    const total = parseInt(countRes?.count || '0', 10);

    const rows = await TxManager.query<any>(
      `SELECT * FROM v_job_progress
       ${whereClause}
        ORDER BY job_id DESC
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

  /**
   * Shift Output Breakdown (reads from view v_output_by_machine_shift)
   */
  static async getShiftOutput(query: ShiftOutputQuery): Promise<any[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (query.productionDate) {
      conditions.push(`production_date = $${paramIdx++}::date`);
      values.push(query.productionDate);
    }
    if (query.shiftId) {
      conditions.push(`shift_id = $${paramIdx++}`);
      values.push(query.shiftId);
    }
    if (query.machineId) {
      conditions.push(`machine_id = $${paramIdx++}`);
      values.push(query.machineId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return await TxManager.query<any>(
      `SELECT * FROM v_output_by_machine_shift ${whereClause} ORDER BY production_date DESC, shift_name ASC, machine_code ASC`,
      values
    );
  }

  /**
   * Get Single Job by ID with production logs and fabric rolls
   */
  static async getJobById(jobId: number): Promise<any> {
    const job = await TxManager.queryOne<any>(
      `SELECT pj.job_id, pj.job_no, pj.order_item_id, oi.order_id, co.order_no,
              b.buyer_id, b.name AS buyer_name,
              pj.stage_id, ps.name AS stage_name,
              pj.machine_id, m.machine_code, m.description AS machine_description,
              fp.name AS fabric_product_name, c.name AS colour_name,
              pj.planned_qty, u.unit_code, pj.status, pj.started_at, pj.ended_at,
              pj.version, pj.created_at, u_cre.username AS created_by_username
         FROM production_job pj
         JOIN order_item oi ON pj.order_item_id = oi.order_item_id
         JOIN customer_order co ON oi.order_id = co.order_id
         JOIN buyer b ON co.buyer_id = b.buyer_id
         JOIN process_stage ps ON pj.stage_id = ps.stage_id
         JOIN machine m ON pj.machine_id = m.machine_id
         JOIN fabric_product fp ON oi.product_id = fp.product_id
         JOIN colour c ON oi.colour_id = c.colour_id
         JOIN unit_of_measure u ON fp.unit_id = u.unit_id
    LEFT JOIN app_user u_cre ON pj.created_by = u_cre.user_id
        WHERE pj.job_id = $1`,
      [jobId]
    );

    if (!job) {
      throw new Error('JOB_NOT_FOUND');
    }

    const logs = await TxManager.query<any>(
      `SELECT pl.log_id, pl.shift_id, s.name AS shift_name, pl.operator_id,
              e.full_name AS operator_name, pl.output_qty, pl.logged_at, pl.client_request_id,
              u.username AS created_by_username
         FROM production_log pl
         JOIN shift s ON pl.shift_id = s.shift_id
    LEFT JOIN employee e ON pl.operator_id = e.employee_id
    LEFT JOIN app_user u ON pl.created_by = u.user_id
        WHERE pl.job_id = $1
        ORDER BY pl.logged_at DESC`,
      [jobId]
    );

    const rolls = await TxManager.query<any>(
      `SELECT fr.roll_id, fr.roll_code, fr.length_m, fr.weight_kg, fr.status,
              fr.shelf_location, fr.created_at, e.full_name AS operator_name
         FROM fabric_roll fr
    LEFT JOIN employee e ON fr.operator_id = e.employee_id
        WHERE fr.job_id = $1
        ORDER BY fr.roll_id ASC`,
      [jobId]
    );

    return {
      ...job,
      logs,
      rolls,
    };
  }
}
