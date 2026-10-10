import { TxManager } from '../../database/tx-manager';

export interface AuditLogFilters {
  actorId?: number;
  entityName?: string;
  entityId?: string;
  action?: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  cursor?: number;
}

export class AdminService {
  /**
   * Keyset / Offset paginated search over append-only audit_log table
   */
  static async getAuditLogs(filters: AuditLogFilters): Promise<{ logs: any[]; totalCount: number }> {
    let sql = `
      SELECT 
        al.audit_id,
        al.occurred_at,
        al.actor_id,
        u.username AS actor_username,
        al.action,
        al.entity_name,
        al.entity_id,
        al.before_data,
        al.after_data,
        al.reason,
        al.source
      FROM audit_log al
      LEFT JOIN app_user u ON al.actor_id = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.actorId) {
      params.push(filters.actorId);
      sql += ` AND al.actor_id = $${params.length}`;
    }
    if (filters.entityName) {
      params.push(filters.entityName);
      sql += ` AND al.entity_name = $${params.length}`;
    }
    if (filters.entityId) {
      params.push(filters.entityId);
      sql += ` AND al.entity_id = $${params.length}`;
    }
    if (filters.action) {
      params.push(filters.action);
      sql += ` AND al.action = $${params.length}`;
    }
    if (filters.startDate) {
      params.push(filters.startDate);
      sql += ` AND al.occurred_at >= $${params.length}`;
    }
    if (filters.endDate) {
      params.push(filters.endDate);
      sql += ` AND al.occurred_at <= $${params.length}`;
    }
    if (filters.cursor) {
      params.push(filters.cursor);
      sql += ` AND al.audit_id < $${params.length}`;
    }

    // Count query
    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) sub;`;
    const countRes = await TxManager.queryOne<{ total: string }>(countSql, params);
    const totalCount = parseInt(countRes?.total || '0', 10);

    const limit = Math.min(filters.limit || 50, 200);
    const offset = filters.offset || 0;

    params.push(limit);
    sql += ` ORDER BY al.audit_id DESC LIMIT $${params.length}`;

    if (!filters.cursor && offset > 0) {
      params.push(offset);
      sql += ` OFFSET $${params.length}`;
    }

    const logs = await TxManager.query<any>(sql, params);

    return {
      logs,
      totalCount,
    };
  }

  // =========================================================================
  // Master Data CRUD Operations
  // =========================================================================

  // Suppliers
  static async getSuppliers(activeOnly = false): Promise<any[]> {
    let sql = `SELECT * FROM supplier`;
    if (activeOnly) sql += ` WHERE is_active = true`;
    sql += ` ORDER BY name ASC;`;
    return await TxManager.query<any>(sql);
  }

  static async getSupplierById(supplierId: number): Promise<any> {
    const s = await TxManager.queryOne<any>(`SELECT * FROM supplier WHERE supplier_id = $1;`, [supplierId]);
    if (!s) throw new Error('SUPPLIER_NOT_FOUND');
    return s;
  }

  static async createSupplier(data: { name: string; contact?: string; taxId?: string }, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      { userId, source: 'AdminService.createSupplier', reason: `Created supplier: ${data.name}` },
      async (client) => {
        const res = await client.query(
          `INSERT INTO supplier (name, contact, tax_id, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $4)
           RETURNING *;`,
          [data.name.trim(), data.contact || null, data.taxId || null, userId]
        );
        return res.rows[0];
      }
    );
  }

  static async updateSupplier(supplierId: number, data: { name?: string; contact?: string; taxId?: string; isActive?: boolean }, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      { userId, source: 'AdminService.updateSupplier', reason: `Updated supplier ID #${supplierId}` },
      async (client) => {
        const current = await client.query(`SELECT * FROM supplier WHERE supplier_id = $1;`, [supplierId]);
        if (current.rowCount === 0) throw new Error('SUPPLIER_NOT_FOUND');

        const name = data.name !== undefined ? data.name.trim() : current.rows[0].name;
        const contact = data.contact !== undefined ? data.contact : current.rows[0].contact;
        const taxId = data.taxId !== undefined ? data.taxId : current.rows[0].tax_id;
        const isActive = data.isActive !== undefined ? data.isActive : current.rows[0].is_active;

        const res = await client.query(
          `UPDATE supplier
              SET name = $1, contact = $2, tax_id = $3, is_active = $4, updated_by = $5, updated_at = now()
            WHERE supplier_id = $6
            RETURNING *;`,
          [name, contact, taxId, isActive, userId, supplierId]
        );
        return res.rows[0];
      }
    );
  }

  // Buyers
  static async getBuyers(activeOnly = false): Promise<any[]> {
    let sql = `SELECT * FROM buyer`;
    if (activeOnly) sql += ` WHERE is_active = true`;
    sql += ` ORDER BY name ASC;`;
    return await TxManager.query<any>(sql);
  }

  static async getBuyerById(buyerId: number): Promise<any> {
    const b = await TxManager.queryOne<any>(`SELECT * FROM buyer WHERE buyer_id = $1;`, [buyerId]);
    if (!b) throw new Error('BUYER_NOT_FOUND');
    return b;
  }

  static async createBuyer(data: { name: string; contact?: string; taxId?: string }, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      { userId, source: 'AdminService.createBuyer', reason: `Created buyer: ${data.name}` },
      async (client) => {
        const res = await client.query(
          `INSERT INTO buyer (name, contact, tax_id, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $4)
           RETURNING *;`,
          [data.name.trim(), data.contact || null, data.taxId || null, userId]
        );
        return res.rows[0];
      }
    );
  }

  static async updateBuyer(buyerId: number, data: { name?: string; contact?: string; taxId?: string; isActive?: boolean }, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      { userId, source: 'AdminService.updateBuyer', reason: `Updated buyer ID #${buyerId}` },
      async (client) => {
        const current = await client.query(`SELECT * FROM buyer WHERE buyer_id = $1;`, [buyerId]);
        if (current.rowCount === 0) throw new Error('BUYER_NOT_FOUND');

        const name = data.name !== undefined ? data.name.trim() : current.rows[0].name;
        const contact = data.contact !== undefined ? data.contact : current.rows[0].contact;
        const taxId = data.taxId !== undefined ? data.taxId : current.rows[0].tax_id;
        const isActive = data.isActive !== undefined ? data.isActive : current.rows[0].is_active;

        const res = await client.query(
          `UPDATE buyer
              SET name = $1, contact = $2, tax_id = $3, is_active = $4, updated_by = $5, updated_at = now()
            WHERE buyer_id = $6
            RETURNING *;`,
          [name, contact, taxId, isActive, userId, buyerId]
        );
        return res.rows[0];
      }
    );
  }

  // Yarn Items & Masters
  static async getYarnItems(): Promise<any[]> {
    return await TxManager.query<any>(
      `SELECT yi.yarn_item_id, yi.yarn_type_id, yt.name AS yarn_type_name,
              yi.colour_id, c.name AS colour_name, yi.unit_id, u.unit_code,
              yi.reorder_level, yi.is_active
         FROM yarn_item yi
         JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
         JOIN colour c ON yi.colour_id = c.colour_id
         JOIN unit_of_measure u ON yi.unit_id = u.unit_id
        ORDER BY yt.name ASC, c.name ASC;`
    );
  }

  static async createYarnItem(data: { yarnTypeId: number; colourId: number; unitId: number; reorderLevel?: number }, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      { userId, source: 'AdminService.createYarnItem', reason: `Created yarn item` },
      async (client) => {
        const res = await client.query(
          `INSERT INTO yarn_item (yarn_type_id, colour_id, unit_id, reorder_level, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $5)
           RETURNING *;`,
          [data.yarnTypeId, data.colourId, data.unitId, data.reorderLevel || 0, userId]
        );
        return res.rows[0];
      }
    );
  }

  // Fabric Products
  static async getFabricProducts(): Promise<any[]> {
    return await TxManager.query<any>(
      `SELECT fp.product_id, fp.name, fp.specification, fp.unit_id, u.unit_code, fp.is_active
         FROM fabric_product fp
         JOIN unit_of_measure u ON fp.unit_id = u.unit_id
        ORDER BY fp.name ASC;`
    );
  }

  static async createFabricProduct(data: { name: string; specification?: string; unitId: number }, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      { userId, source: 'AdminService.createFabricProduct', reason: `Created fabric product: ${data.name}` },
      async (client) => {
        const res = await client.query(
          `INSERT INTO fabric_product (name, specification, unit_id, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $4)
           RETURNING *;`,
          [data.name.trim(), data.specification || null, data.unitId, userId]
        );
        return res.rows[0];
      }
    );
  }

  // Machines
  static async getMachines(): Promise<any[]> {
    return await TxManager.query<any>(
      `SELECT m.machine_id, m.machine_code, m.stage_id, ps.name AS stage_name,
              m.description, m.is_active
         FROM machine m
         JOIN process_stage ps ON m.stage_id = ps.stage_id
        ORDER BY m.machine_code ASC;`
    );
  }

  static async createMachine(data: { machineCode: string; stageId: number; description?: string }, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      { userId, source: 'AdminService.createMachine', reason: `Created machine ${data.machineCode}` },
      async (client) => {
        const res = await client.query(
          `INSERT INTO machine (machine_code, stage_id, description, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $4)
           RETURNING *;`,
          [data.machineCode.trim().toUpperCase(), data.stageId, data.description || null, userId]
        );
        return res.rows[0];
      }
    );
  }

  // Defect Types
  static async getDefectTypes(): Promise<any[]> {
    return await TxManager.query<any>(
      `SELECT defect_type_id, name, is_active FROM defect_type ORDER BY name ASC;`
    );
  }

  static async createDefectType(name: string, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      { userId, source: 'AdminService.createDefectType', reason: `Created defect type: ${name}` },
      async (client) => {
        const res = await client.query(
          `INSERT INTO defect_type (name, created_by, updated_by)
           VALUES ($1, $2, $2)
           RETURNING *;`,
          [name.trim(), userId]
        );
        return res.rows[0];
      }
    );
  }

  // Employees
  static async getEmployees(): Promise<any[]> {
    return await TxManager.query<any>(
      `SELECT employee_id, employee_code, full_name, designation, pay_basis, is_active, created_at
         FROM employee
        ORDER BY employee_code ASC;`
    );
  }

  static async createEmployee(data: { employeeCode: string; fullName: string; designation?: string; payBasis: 'daily' | 'monthly' | 'piece_rate'; payRate: number }, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      { userId, source: 'AdminService.createEmployee', reason: `Created employee: ${data.fullName}` },
      async (client) => {
        const res = await client.query(
          `INSERT INTO employee (employee_code, full_name, designation, pay_basis, pay_rate, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $6)
           RETURNING employee_id, employee_code, full_name, designation, pay_basis, is_active;`,
          [data.employeeCode.trim(), data.fullName.trim(), data.designation || null, data.payBasis, data.payRate, userId]
        );
        return res.rows[0];
      }
    );
  }

  // Shifts
  static async getShifts(): Promise<any[]> {
    return await TxManager.query<any>(
      `SELECT shift_id, name, starts_at, ends_at, is_active FROM shift ORDER BY starts_at ASC;`
    );
  }

  static async createShift(data: { name: string; startsAt: string; endsAt: string }, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      { userId, source: 'AdminService.createShift', reason: `Created shift: ${data.name}` },
      async (client) => {
        const res = await client.query(
          `INSERT INTO shift (name, starts_at, ends_at, created_by, updated_by)
           VALUES ($1, $2::time, $3::time, $4, $4)
           RETURNING *;`,
          [data.name.trim(), data.startsAt, data.endsAt, userId]
        );
        return res.rows[0];
      }
    );
  }
}
