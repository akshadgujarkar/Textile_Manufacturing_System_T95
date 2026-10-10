import { TxManager } from '../../database/tx-manager';

export interface AttendanceRecordInput {
  employeeId: number;
  workDate: string;
  shiftId: number;
  status: 'present' | 'absent' | 'half_day' | 'leave';
  hoursWorked: number;
}

export interface WageSummaryRow {
  wage_id: number;
  period_id: number;
  period_start: string;
  period_end: string;
  employee_id: number;
  employee_code: string;
  employee_name: string;
  designation: string | null;
  pay_basis: string;
  pay_rate: number | null | string;
  days_present: number;
  days_half_day: number;
  days_absent: number;
  total_hours_worked: number;
  computed_gross_wage: number | null | string;
  basis_note: string | null;
  wage_status: string;
  approved_at: string | null;
  approved_by_username: string | null;
}

export class WorkforceService {
  /**
   * Batch upsert employee daily attendance records (WF-13a)
   * Enforces status/hours_worked validation and trigger guard against editing attendance for approved wages (BR004)
   */
  static async recordAttendance(
    records: AttendanceRecordInput[],
    userId: number
  ): Promise<{ recordedCount: number; records: any[] }> {
    if (!records || records.length === 0) {
      throw new Error('NO_RECORDS_PROVIDED');
    }

    return await TxManager.withTransaction(
      {
        userId,
        source: 'WorkforceService.recordAttendance',
        reason: `Batch recorded attendance for ${records.length} employee-shifts`,
      },
      async (client) => {
        const insertedRows: any[] = [];

        for (const rec of records) {
          // Validate hours worked matches status
          if ((rec.status === 'absent' || rec.status === 'leave') && rec.hoursWorked !== 0) {
            throw new Error(`INVALID_HOURS: Hours worked must be 0 for status ${rec.status}`);
          }
          if ((rec.status === 'present' || rec.status === 'half_day') && (rec.hoursWorked <= 0 || rec.hoursWorked > 24)) {
            throw new Error(`INVALID_HOURS: Hours worked must be between 0 and 24 for status ${rec.status}`);
          }

          const res = await client.query(
            `INSERT INTO attendance_record (
              employee_id,
              work_date,
              shift_id,
              status,
              hours_worked,
              created_by,
              updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $6)
            ON CONFLICT (employee_id, work_date, shift_id) DO UPDATE
              SET status = EXCLUDED.status,
                  hours_worked = EXCLUDED.hours_worked,
                  updated_by = EXCLUDED.updated_by,
                  updated_at = now()
            RETURNING *;`,
            [rec.employeeId, rec.workDate, rec.shiftId, rec.status, rec.hoursWorked, userId]
          );
          insertedRows.push(res.rows[0]);
        }

        return {
          recordedCount: insertedRows.length,
          records: insertedRows,
        };
      }
    );
  }

  /**
   * List attendance records with optional filtering
   */
  static async listAttendance(filters: {
    employeeId?: number;
    startDate?: string;
    endDate?: string;
    shiftId?: number;
  }): Promise<any[]> {
    let sql = `
      SELECT 
        ar.attendance_id,
        ar.employee_id,
        e.employee_code,
        e.full_name AS employee_name,
        ar.work_date,
        ar.shift_id,
        s.name AS shift_name,
        ar.status,
        ar.hours_worked,
        ar.created_at,
        ar.updated_at
      FROM attendance_record ar
      JOIN employee e ON ar.employee_id = e.employee_id
      JOIN shift s ON ar.shift_id = s.shift_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.employeeId) {
      params.push(filters.employeeId);
      sql += ` AND ar.employee_id = $${params.length}`;
    }
    if (filters.startDate) {
      params.push(filters.startDate);
      sql += ` AND ar.work_date >= $${params.length}`;
    }
    if (filters.endDate) {
      params.push(filters.endDate);
      sql += ` AND ar.work_date <= $${params.length}`;
    }
    if (filters.shiftId) {
      params.push(filters.shiftId);
      sql += ` AND ar.shift_id = $${params.length}`;
    }

    sql += ` ORDER BY ar.work_date DESC, ar.employee_id ASC;`;

    return await TxManager.query<any>(sql, params);
  }

  /**
   * Month-end wage draft generation (WF-13b)
   * Computes hours/credits and creates draft wage_record entries for active employees.
   */
  static async generateMonthlyWages(
    periodId: number,
    userId: number
  ): Promise<{ periodId: number; generatedCount: number; wages: any[] }> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'WorkforceService.generateMonthlyWages',
        reason: `Generated draft monthly wages for period ${periodId}`,
      },
      async (client) => {
        // 1. Verify period existence & open status
        const periodRes = await client.query(
          `SELECT period_id, period_start, period_end, status FROM accounting_period WHERE period_id = $1;`,
          [periodId]
        );

        if (periodRes.rowCount === 0) {
          throw new Error('PERIOD_NOT_FOUND');
        }

        const period = periodRes.rows[0];
        if (period.status !== 'open') {
          throw new Error('PERIOD_CLOSED: Cannot generate wages in a closed accounting period');
        }

        // 2. Fetch all active employees
        const empRes = await client.query(
          `SELECT employee_id, employee_code, full_name, pay_basis, pay_rate 
           FROM employee 
           WHERE is_active = true;`
        );

        const wagesCreated: any[] = [];

        for (const emp of empRes.rows) {
          let grossAmount = 0;
          let basisNote = '';

          if (emp.pay_basis === 'daily') {
            // One credit per day even if two shifts
            const creditRes = await client.query(
              `WITH day_credit AS (
                 SELECT employee_id, work_date,
                        MAX(CASE status WHEN 'present' THEN 1 WHEN 'half_day' THEN 0.5 ELSE 0 END) AS credit
                   FROM attendance_record 
                  WHERE employee_id = $1 AND work_date BETWEEN $2 AND $3 
                  GROUP BY employee_id, work_date
               )
               SELECT COALESCE(SUM(credit), 0) AS total_credits FROM day_credit;`,
              [emp.employee_id, period.period_start, period.period_end]
            );

            const credits = parseFloat(creditRes.rows[0]?.total_credits || '0');
            const rate = parseFloat(emp.pay_rate || '0');
            grossAmount = Math.round(credits * rate * 100) / 100;
            basisNote = `Daily rate ₹${rate} x ${credits} working days`;
          } else if (emp.pay_basis === 'monthly') {
            // Flat monthly fixed rate
            const rate = parseFloat(emp.pay_rate || '0');
            grossAmount = Math.round(rate * 100) / 100;
            basisNote = `Fixed monthly salary ₹${rate}`;
          } else if (emp.pay_basis === 'piece_rate') {
            // Production log output based
            const prodRes = await client.query(
              `SELECT COALESCE(SUM(pl.output_qty), 0) AS total_output
               FROM production_log pl
               WHERE pl.operator_id = $1
                 AND (pl.logged_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $2 AND $3;`,
              [emp.employee_id, period.period_start, period.period_end]
            );

            const totalOutput = parseFloat(prodRes.rows[0]?.total_output || '0');
            const rate = parseFloat(emp.pay_rate || '0');
            grossAmount = Math.round(totalOutput * rate * 100) / 100;
            basisNote = `Piece rate ₹${rate}/unit x ${totalOutput} units produced`;
          }

          // Upsert draft wage record (if existing draft, update gross; if approved, skip)
          const wageRes = await client.query(
            `INSERT INTO wage_record (
              employee_id,
              period_id,
              gross_amount,
              basis_note,
              status,
              created_by,
              updated_by
            ) VALUES ($1, $2, $3, $4, 'draft', $5, $5)
            ON CONFLICT (employee_id, period_id) WHERE status <> 'reversed' DO UPDATE
              SET gross_amount = EXCLUDED.gross_amount,
                  basis_note = EXCLUDED.basis_note,
                  updated_by = EXCLUDED.updated_by,
                  updated_at = now()
              WHERE wage_record.status = 'draft'
            RETURNING *;`,
            [emp.employee_id, periodId, grossAmount, basisNote, userId]
          );

          if (wageRes.rowCount && wageRes.rowCount > 0) {
            wagesCreated.push(wageRes.rows[0]);
          }
        }

        return {
          periodId,
          generatedCount: wagesCreated.length,
          wages: wagesCreated,
        };
      }
    );
  }

  /**
   * Approve draft wage record (WF-13c)
   * Automatically triggers `trg_wage_cost` to post plant-level wage cost_entry.
   */
  static async approveWageRecord(
    wageId: number,
    userId: number
  ): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'WorkforceService.approveWageRecord',
        reason: `Approved wage record #${wageId}`,
      },
      async (client) => {
        const wageRes = await client.query(
          `SELECT wage_id, employee_id, period_id, gross_amount, status 
           FROM wage_record 
           WHERE wage_id = $1 
           FOR UPDATE;`,
          [wageId]
        );

        if (wageRes.rowCount === 0) {
          throw new Error('WAGE_NOT_FOUND');
        }

        const wage = wageRes.rows[0];
        if (wage.status !== 'draft') {
          throw new Error(`INVALID_STATUS: Wage record is in status '${wage.status}' (must be 'draft')`);
        }

        const updateRes = await client.query(
          `UPDATE wage_record
           SET status = 'approved',
               updated_by = $2,
               updated_at = now()
           WHERE wage_id = $1
           RETURNING *;`,
          [wageId, userId]
        );

        return updateRes.rows[0];
      }
    );
  }

  /**
   * Reverse approved wage record (WF-13d)
   * Automatically triggers negative twin cost_entry in cost ledger.
   */
  static async reverseWageRecord(
    wageId: number,
    reason: string,
    userId: number
  ): Promise<any> {
    if (!reason || reason.trim().length < 5) {
      throw new Error('INVALID_REASON: Reverse reason must be at least 5 characters');
    }

    return await TxManager.withTransaction(
      {
        userId,
        source: 'WorkforceService.reverseWageRecord',
        reason: `Reversed wage record #${wageId}: ${reason}`,
      },
      async (client) => {
        const wageRes = await client.query(
          `SELECT wage_id, employee_id, period_id, gross_amount, status 
           FROM wage_record 
           WHERE wage_id = $1 
           FOR UPDATE;`,
          [wageId]
        );

        if (wageRes.rowCount === 0) {
          throw new Error('WAGE_NOT_FOUND');
        }

        const wage = wageRes.rows[0];
        if (wage.status !== 'approved') {
          throw new Error(`INVALID_STATUS: Wage record is in status '${wage.status}' (must be 'approved')`);
        }

        const updateRes = await client.query(
          `UPDATE wage_record
           SET status = 'reversed',
               reverse_reason = $2,
               updated_by = $3,
               updated_at = now()
           WHERE wage_id = $1
           RETURNING *;`,
          [wageId, reason, userId]
        );

        return updateRes.rows[0];
      }
    );
  }

  /**
   * Fetch wage summary view with RBAC redaction for non-finance roles
   * Acceptance criterion: employee.pay_rate and wage_record.gross_amount are redacted from non-finance roles.
   */
  static async getWageSummary(
    periodId?: number,
    userRoles?: string[] | string
  ): Promise<WageSummaryRow[]> {
    let sql = `SELECT * FROM v_wage_summary WHERE 1=1`;
    const params: any[] = [];

    if (periodId) {
      params.push(periodId);
      sql += ` AND period_id = $${params.length}`;
    }

    sql += ` ORDER BY period_id DESC, employee_id ASC;`;

    const rows = await TxManager.query<WageSummaryRow>(sql, params);

    const rolesList = Array.isArray(userRoles) ? userRoles : (userRoles ? [userRoles] : []);
    const isFinanceRole = rolesList.some((role) => ['accounts', 'owner', 'admin'].includes(role));

    if (!isFinanceRole) {
      // Redact sensitive salary and rate columns
      return rows.map((r) => ({
        ...r,
        pay_rate: null,
        computed_gross_wage: null,
        basis_note: '[REDACTED]',
      }));
    }

    return rows;
  }
}

