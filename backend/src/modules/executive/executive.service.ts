import { TxManager } from '../../database/tx-manager';

export interface MonthlyPLRow {
  period_id: number;
  period_start: string;
  period_end: string;
  period_status: string;
  gross_sales_revenue: string | number;
  material_expense: string | number;
  wage_expense: string | number;
  overhead_expense: string | number;
  total_operating_expenses: string | number;
  net_profit_loss: string | number;
  net_profit_margin_pct: string | number;
}

export interface OrderCostRow {
  order_id: number;
  order_no: string;
  buyer_name: string;
  order_date: string;
  order_status: string;
  total_revenue: string | number;
  total_material_cost: string | number;
  gross_contribution_margin: string | number;
  gross_margin_pct: string | number;
}

export interface RollCostRow {
  roll_id: number;
  roll_code: string;
  length_m: string | number;
  order_no: string;
  buyer_name: string;
  fabric_product_name: string;
  period_id: number;
  estimated_material_cost: string | number;
  allocated_wage_cost: string | number;
  allocated_overhead_cost: string | number;
  total_estimated_roll_cost: string | number;
}

export interface MachineOutputRow {
  machine_id: number;
  machine_code: string;
  process_stage_name: string;
  period_id: number;
  period_start: string;
  period_end: string;
  total_output_produced: string | number;
  total_logs_count: number;
  breakdown_hours: string | number;
  maintenance_hours: string | number;
}

export class ExecutiveService {
  /**
   * Executive Monthly Profit & Loss Statement (v_monthly_pl)
   * Gross Sales Revenue - Materials - Wages - Overheads = Net Profit/Loss
   */
  static async getExecutivePL(periodId?: number): Promise<MonthlyPLRow[]> {
    let sql = `SELECT * FROM v_monthly_pl WHERE 1=1`;
    const params: any[] = [];

    if (periodId) {
      params.push(periodId);
      sql += ` AND period_id = $${params.length}`;
    }

    sql += ` ORDER BY period_start DESC;`;

    return await TxManager.query<MonthlyPLRow>(sql, params);
  }

  /**
   * Order-Level Costing & Contribution Margin (v_order_cost)
   */
  static async getOrderCosting(orderId?: number): Promise<OrderCostRow[]> {
    let sql = `SELECT * FROM v_order_cost WHERE 1=1`;
    const params: any[] = [];

    if (orderId) {
      params.push(orderId);
      sql += ` AND order_id = $${params.length}`;
    }

    sql += ` ORDER BY order_date DESC;`;

    return await TxManager.query<OrderCostRow>(sql, params);
  }

  /**
   * Roll-Level Costing with Direct & Allocated Overheads (v_roll_cost)
   */
  static async getRollCosting(rollId?: number): Promise<RollCostRow[]> {
    let sql = `SELECT * FROM v_roll_cost WHERE 1=1`;
    const params: any[] = [];

    if (rollId) {
      params.push(rollId);
      sql += ` AND roll_id = $${params.length}`;
    }

    sql += ` ORDER BY roll_id DESC;`;

    return await TxManager.query<RollCostRow>(sql, params);
  }

  /**
   * Machine Productivity & Downtime Analytics (v_machine_output)
   */
  static async getMachineProductivity(
    periodId?: number,
    machineId?: number
  ): Promise<MachineOutputRow[]> {
    let sql = `SELECT * FROM v_machine_output WHERE 1=1`;
    const params: any[] = [];

    if (periodId) {
      params.push(periodId);
      sql += ` AND period_id = $${params.length}`;
    }
    if (machineId) {
      params.push(machineId);
      sql += ` AND machine_id = $${params.length}`;
    }

    sql += ` ORDER BY machine_id ASC, period_start DESC;`;

    return await TxManager.query<MachineOutputRow>(sql, params);
  }
}
