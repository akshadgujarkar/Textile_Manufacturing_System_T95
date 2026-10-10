import { PoolClient } from 'pg';
import { TxManager } from '../../database/tx-manager';
import { Qty } from '../../types';

export interface CreateDispatchDto {
  buyerId: number;
  orderId: number;
  vehicleNo?: string;
}

export interface ScanRollDto {
  rollCode: string;
}

export interface RemoveRollDto {
  reason: string;
}

export interface CompleteDispatchDto {
  vehicleNo: string;
}

export interface CancelDispatchDto {
  reason: string;
}

export interface ListDispatchesQuery {
  status?: 'draft' | 'loading' | 'dispatched' | 'cancelled';
  buyerId?: number;
  orderId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export class DispatchService {
  /**
   * Create a new Dispatch Manifest in 'draft' status
   * Roles: dispatch, admin, owner
   */
  static async createDispatch(
    dto: CreateDispatchDto,
    userId: number
  ): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'DISPATCH_CREATE',
        reason: `Create dispatch manifest for order ID: ${dto.orderId}, buyer ID: ${dto.buyerId}`,
      },
      async (client: PoolClient) => {
        // 1. Verify Customer Order belongs to the Buyer and is confirmed/closed
        const orderRes = await client.query(
          `SELECT order_id, order_no, buyer_id, status 
             FROM customer_order 
            WHERE order_id = $1 AND buyer_id = $2`,
          [dto.orderId, dto.buyerId]
        );

        if (orderRes.rowCount === 0) {
          throw new Error('ORDER_BUYER_MISMATCH: Order does not exist or does not belong to the specified buyer.');
        }

        const order = orderRes.rows[0];
        if (order.status !== 'confirmed' && order.status !== 'closed') {
          throw new Error(`ORDER_NOT_DISPATCHABLE: Order is "${order.status}". Only confirmed or active orders can be dispatched.`);
        }

        // 2. Insert dispatch header (draft)
        const dispatchRes = await client.query(
          `INSERT INTO dispatch (
             buyer_id, order_id, vehicle_no, status, version
           ) VALUES (
             $1, $2, $3, 'draft', 1
           ) RETURNING dispatch_id, dispatch_no, buyer_id, order_id, vehicle_no, 
                       status, version, created_at, created_by`,
          [
            dto.buyerId,
            dto.orderId,
            dto.vehicleNo ? dto.vehicleNo.trim().toUpperCase() : null,
          ]
        );

        return dispatchRes.rows[0];
      }
    );
  }

  /**
   * Explicitly transition Dispatch to 'loading' status
   */
  static async startLoading(
    dispatchId: number,
    expectedVersion: number,
    userId: number
  ): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'DISPATCH_LOADING_START',
        reason: `Start loading dispatch manifest ID: ${dispatchId}`,
      },
      async (client: PoolClient) => {
        const dspRes = await client.query(
          `SELECT dispatch_id, status, version FROM dispatch WHERE dispatch_id = $1 FOR UPDATE`,
          [dispatchId]
        );

        if (dspRes.rowCount === 0) {
          throw new Error('DISPATCH_NOT_FOUND');
        }

        const dsp = dspRes.rows[0];
        if (dsp.version !== expectedVersion) {
          throw new Error('CONCURRENT_MODIFICATION');
        }
        if (dsp.status !== 'draft') {
          throw new Error(`INVALID_STATUS: Current status is "${dsp.status}". Only draft dispatches can start loading.`);
        }

        const updatedRes = await client.query(
          `UPDATE dispatch 
              SET status = 'loading', 
                  version = version + 1, 
                  updated_at = now() 
            WHERE dispatch_id = $1 
        RETURNING dispatch_id, dispatch_no, buyer_id, order_id, vehicle_no, status, version, updated_at`,
          [dispatchId]
        );

        return updatedRes.rows[0];
      }
    );
  }

  /**
   * WF-9: Scan Roll to Dispatch Manifest
   * Real-time double-dispatch prevention via partial unique index and triggers.
   */
  static async scanRollToDispatch(
    dispatchId: number,
    rollCode: string,
    userId: number
  ): Promise<{ dispatchItem: any; roll: any; dispatch: any }> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'DISPATCH_SCAN_ROLL',
        reason: `Scan roll ${rollCode} onto dispatch ID: ${dispatchId}`,
      },
      async (client: PoolClient) => {
        // 1. Lock dispatch manifest
        const dspRes = await client.query(
          `SELECT dispatch_id, dispatch_no, buyer_id, order_id, status, version 
             FROM dispatch 
            WHERE dispatch_id = $1 
              FOR UPDATE`,
          [dispatchId]
        );

        if (dspRes.rowCount === 0) {
          throw new Error('DISPATCH_NOT_FOUND');
        }

        const dsp = dspRes.rows[0];
        if (dsp.status !== 'draft' && dsp.status !== 'loading') {
          throw new Error(`DISPATCH_CLOSED: Dispatch ${dsp.dispatch_no} is currently "${dsp.status}". Rolls cannot be added.`);
        }

        // 2. Lock and fetch fabric roll
        const rollRes = await client.query(
          `SELECT fr.roll_id, fr.roll_code, fr.job_id, fr.status, fr.length_m, fr.weight_kg,
                  oi.order_id AS roll_order_id, co.order_no
             FROM fabric_roll fr
             JOIN production_job pj ON fr.job_id = pj.job_id
             JOIN order_item oi ON pj.order_item_id = oi.order_item_id
             JOIN customer_order co ON oi.order_id = co.order_id
            WHERE fr.roll_code = $1 
              FOR UPDATE`,
          [rollCode.trim().toUpperCase()]
        );

        if (rollRes.rowCount === 0) {
          throw new Error(`ROLL_NOT_FOUND: Roll ${rollCode} does not exist.`);
        }

        const roll = rollRes.rows[0];

        // 3. Invariant Checks
        if (roll.status !== 'in_stock') {
          throw new Error(`ROLL_NOT_IN_STOCK: Roll ${roll.roll_code} cannot be dispatched because its status is "${roll.status}". Must be passed QC and in_stock.`);
        }

        if (Number(roll.roll_order_id) !== Number(dsp.order_id)) {
          throw new Error(`ROLL_ORDER_MISMATCH: Roll ${roll.roll_code} belongs to Order ${roll.order_no}, which does not match Dispatch Order ID ${dsp.order_id}.`);
        }

        // 4. Insert into dispatch_item
        // This fires trg_dispatch_item_before which:
        // - Updates fabric_roll.status = 'loaded'
        // - Sets dispatch.status = 'loading' if it was 'draft'
        // Index uq_dispatch_item_one_active_roll guarantees single active truck
        const itemRes = await client.query(
          `INSERT INTO dispatch_item (
             dispatch_id, roll_id, state
           ) VALUES (
             $1, $2, 'active'
           ) RETURNING dispatch_item_id, dispatch_id, roll_id, scanned_at, scanned_by, state`,
          [dsp.dispatch_id, roll.roll_id]
        );

        const updatedRollRes = await client.query(
          `SELECT roll_id, roll_code, status, length_m, weight_kg FROM fabric_roll WHERE roll_id = $1`,
          [roll.roll_id]
        );

        const updatedDspRes = await client.query(
          `SELECT dispatch_id, dispatch_no, status FROM dispatch WHERE dispatch_id = $1`,
          [dsp.dispatch_id]
        );

        return {
          dispatchItem: itemRes.rows[0],
          roll: updatedRollRes.rows[0],
          dispatch: updatedDspRes.rows[0],
        };
      }
    );
  }

  /**
   * Remove Roll from Dispatch Manifest
   * Transitions dispatch_item.state = 'removed' and automatically returns roll to 'in_stock'.
   */
  static async removeRollFromDispatch(
    dispatchItemId: number,
    reason: string,
    userId: number
  ): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'DISPATCH_REMOVE_ROLL',
        reason: `Remove dispatch item ID: ${dispatchItemId}. Reason: ${reason}`,
      },
      async (client: PoolClient) => {
        // 1. Lock dispatch item and dispatch
        const itemRes = await client.query(
          `SELECT di.dispatch_item_id, di.dispatch_id, di.roll_id, di.state, d.status AS dispatch_status
             FROM dispatch_item di
             JOIN dispatch d ON di.dispatch_id = d.dispatch_id
            WHERE di.dispatch_item_id = $1 
              FOR UPDATE OF di`,
          [dispatchItemId]
        );

        if (itemRes.rowCount === 0) {
          throw new Error('DISPATCH_ITEM_NOT_FOUND');
        }

        const item = itemRes.rows[0];

        if (item.state === 'removed') {
          throw new Error('ITEM_ALREADY_REMOVED');
        }

        if (item.dispatch_status !== 'draft' && item.dispatch_status !== 'loading') {
          throw new Error(`CANNOT_REMOVE_FROM_DISPATCHED: Cannot remove rolls from a dispatch with status "${item.dispatch_status}".`);
        }

        // 2. Update dispatch_item
        // This fires trg_dispatch_item_upd which sets fabric_roll.status = 'in_stock'
        const updatedRes = await client.query(
          `UPDATE dispatch_item 
              SET state = 'removed',
                  remove_reason = $1,
                  removed_at = now(),
                  removed_by = $2
            WHERE dispatch_item_id = $3
        RETURNING dispatch_item_id, dispatch_id, roll_id, state, removed_at, remove_reason`,
          [reason.trim(), userId, dispatchItemId]
        );

        return updatedRes.rows[0];
      }
    );
  }

  /**
   * WF-10: Complete Dispatch Manifest
   * Validates loaded rolls, sets dispatch status = 'dispatched', and updates all active rolls to 'dispatched'.
   */
  static async completeDispatch(
    dispatchId: number,
    vehicleNo: string,
    userId: number
  ): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'DISPATCH_COMPLETE',
        reason: `Complete dispatch manifest ID: ${dispatchId}, vehicle: ${vehicleNo}`,
      },
      async (client: PoolClient) => {
        // 1. Lock dispatch
        const dspRes = await client.query(
          `SELECT dispatch_id, dispatch_no, buyer_id, order_id, status, version 
             FROM dispatch 
            WHERE dispatch_id = $1 
              FOR UPDATE`,
          [dispatchId]
        );

        if (dspRes.rowCount === 0) {
          throw new Error('DISPATCH_NOT_FOUND');
        }

        const dsp = dspRes.rows[0];

        if (dsp.status === 'dispatched') {
          throw new Error('DISPATCH_ALREADY_COMPLETED');
        }
        if (dsp.status === 'cancelled') {
          throw new Error('DISPATCH_CANCELLED');
        }

        // 2. Verify at least 1 active loaded roll exists
        const countRes = await client.query(
          `SELECT count(*) as count FROM dispatch_item WHERE dispatch_id = $1 AND state = 'active'`,
          [dispatchId]
        );
        const activeCount = parseInt(countRes.rows[0].count, 10);
        if (activeCount === 0) {
          throw new Error('CANNOT_COMPLETE_EMPTY_DISPATCH: At least one active roll must be scanned onto the truck before completion.');
        }

        // 3. Update dispatch
        // This fires trg_dispatch_before (records dispatched_at) and trg_dispatch_after (updates all active rolls to 'dispatched')
        const updatedRes = await client.query(
          `UPDATE dispatch 
              SET status = 'dispatched',
                  vehicle_no = $1,
                  dispatched_at = now(),
                  version = version + 1,
                  updated_at = now()
            WHERE dispatch_id = $2
        RETURNING dispatch_id, dispatch_no, buyer_id, order_id, vehicle_no, 
                   status, dispatched_at, version, updated_at`,
          [vehicleNo.trim().toUpperCase(), dispatchId]
        );

        return {
          ...updatedRes.rows[0],
          dispatchedRollsCount: activeCount,
        };
      }
    );
  }

  /**
   * Cancel Dispatch Manifest
   */
  static async cancelDispatch(
    dispatchId: number,
    reason: string,
    userId: number
  ): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'DISPATCH_CANCEL',
        reason: `Cancel dispatch ID: ${dispatchId}. Reason: ${reason}`,
      },
      async (client: PoolClient) => {
        const dspRes = await client.query(
          `SELECT dispatch_id, dispatch_no, status, version 
             FROM dispatch 
            WHERE dispatch_id = $1 
              FOR UPDATE`,
          [dispatchId]
        );

        if (dspRes.rowCount === 0) {
          throw new Error('DISPATCH_NOT_FOUND');
        }

        const dsp = dspRes.rows[0];

        if (dsp.status === 'cancelled') {
          throw new Error('DISPATCH_ALREADY_CANCELLED');
        }
        if (dsp.status === 'dispatched') {
          throw new Error('CANNOT_CANCEL_COMPLETED_DISPATCH: A dispatched load cannot be cancelled.');
        }

        // Update dispatch status to cancelled
        // This fires trg_dispatch_before and trg_dispatch_after (sets active dispatch_items to 'removed' which returns rolls to 'in_stock')
        const updatedRes = await client.query(
          `UPDATE dispatch 
              SET status = 'cancelled',
                  cancel_reason = $1,
                  version = version + 1,
                  updated_at = now()
            WHERE dispatch_id = $2
        RETURNING dispatch_id, dispatch_no, status, cancelled_at, cancelled_by, cancel_reason, version, updated_at`,
          [reason.trim(), dispatchId]
        );

        return updatedRes.rows[0];
      }
    );
  }

  /**
   * Fetch Single Dispatch Details by ID with items and summary stats
   */
  static async getDispatchById(dispatchId: number): Promise<any> {
    const dsp = await TxManager.queryOne<any>(
      `SELECT d.dispatch_id, d.dispatch_no, d.buyer_id, b.name AS buyer_name,
              d.order_id, co.order_no, d.invoice_id, inv.invoice_no,
              d.vehicle_no, d.status, d.dispatched_at, d.cancelled_at, d.cancel_reason,
              d.version, d.created_at, u_cre.username AS created_by_username
         FROM dispatch d
         JOIN buyer b ON d.buyer_id = b.buyer_id
         JOIN customer_order co ON d.order_id = co.order_id
    LEFT JOIN invoice inv ON d.invoice_id = inv.invoice_id
    LEFT JOIN app_user u_cre ON d.created_by = u_cre.user_id
        WHERE d.dispatch_id = $1`,
      [dispatchId]
    );

    if (!dsp) {
      throw new Error('DISPATCH_NOT_FOUND');
    }

    const items = await TxManager.query<any>(
      `SELECT di.dispatch_item_id, di.dispatch_id, di.roll_id, fr.roll_code,
              fr.length_m, fr.weight_kg, di.scanned_at, u_scan.username AS scanned_by_username,
              di.state, di.removed_at, di.remove_reason,
              fp.name AS fabric_product_name, c.name AS colour_name, m.machine_code
         FROM dispatch_item di
         JOIN fabric_roll fr ON di.roll_id = fr.roll_id
         JOIN production_job pj ON fr.job_id = pj.job_id
         JOIN order_item oi ON pj.order_item_id = oi.order_item_id
         JOIN fabric_product fp ON oi.product_id = fp.product_id
         JOIN colour c ON oi.colour_id = c.colour_id
         JOIN machine m ON pj.machine_id = m.machine_id
    LEFT JOIN app_user u_scan ON di.scanned_by = u_scan.user_id
        WHERE di.dispatch_id = $1
        ORDER BY di.dispatch_item_id ASC`,
      [dispatchId]
    );

    const activeItems = items.filter(i => i.state === 'active');
    const totalActiveRolls = activeItems.length;
    const totalActiveMeters = activeItems.reduce((acc, curr) => acc + Number(curr.length_m), 0);
    const totalActiveWeightKg = activeItems.reduce((acc, curr) => acc + Number(curr.weight_kg || 0), 0);

    return {
      ...dsp,
      stats: {
        totalActiveRolls,
        totalActiveMeters: Number(totalActiveMeters.toFixed(3)),
        totalActiveWeightKg: Number(totalActiveWeightKg.toFixed(3)),
      },
      items,
    };
  }

  /**
   * List Dispatches with pagination and filters
   */
  static async listDispatches(query: ListDispatchesQuery): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (query.status) {
      conditions.push(`d.status = $${paramIdx++}`);
      values.push(query.status);
    }
    if (query.buyerId) {
      conditions.push(`d.buyer_id = $${paramIdx++}`);
      values.push(query.buyerId);
    }
    if (query.orderId) {
      conditions.push(`d.order_id = $${paramIdx++}`);
      values.push(query.orderId);
    }
    if (query.search) {
      conditions.push(`(d.dispatch_no ILIKE $${paramIdx} OR d.vehicle_no ILIKE $${paramIdx} OR b.name ILIKE $${paramIdx} OR co.order_no ILIKE $${paramIdx})`);
      values.push(`%${query.search.trim()}%`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await TxManager.queryOne<{ count: string }>(
      `SELECT count(*) as count 
         FROM dispatch d
         JOIN buyer b ON d.buyer_id = b.buyer_id
         JOIN customer_order co ON d.order_id = co.order_id
       ${whereClause}`,
      values
    );
    const total = parseInt(countRes?.count || '0', 10);

    const rows = await TxManager.query<any>(
      `SELECT d.dispatch_id, d.dispatch_no, d.buyer_id, b.name AS buyer_name,
              d.order_id, co.order_no, d.vehicle_no, d.status, d.dispatched_at,
              d.created_at,
              COUNT(di.dispatch_item_id) FILTER (WHERE di.state = 'active')::int AS active_rolls_count,
              COALESCE(SUM(fr.length_m) FILTER (WHERE di.state = 'active'), 0) AS total_loaded_meters
         FROM dispatch d
         JOIN buyer b ON d.buyer_id = b.buyer_id
         JOIN customer_order co ON d.order_id = co.order_id
    LEFT JOIN dispatch_item di ON d.dispatch_id = di.dispatch_id
    LEFT JOIN fabric_roll fr ON di.roll_id = fr.roll_id
       ${whereClause}
        GROUP BY d.dispatch_id, d.dispatch_no, d.buyer_id, b.name, d.order_id, co.order_no, d.vehicle_no, d.status, d.dispatched_at, d.created_at
        ORDER BY d.created_at DESC, d.dispatch_id DESC
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
   * Dispatch Progress Summary by Order (reads from view v_dispatch_progress)
   */
  static async getDispatchProgress(orderId?: number): Promise<any[]> {
    if (orderId) {
      return await TxManager.query<any>(
        `SELECT * FROM v_dispatch_progress WHERE order_id = $1 ORDER BY order_item_id ASC`,
        [orderId]
      );
    }
    return await TxManager.query<any>(
      `SELECT * FROM v_dispatch_progress ORDER BY order_id DESC, order_item_id ASC`
    );
  }

  /**
   * Active Dispatch Lines for Billing / Commercial Invoicing (reads from view v_dispatch_lines)
   */
  static async getDispatchLines(dispatchId: number): Promise<any[]> {
    return await TxManager.query<any>(
      `SELECT * FROM v_dispatch_lines WHERE dispatch_id = $1`,
      [dispatchId]
    );
  }
}
