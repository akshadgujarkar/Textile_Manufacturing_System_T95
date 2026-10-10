import { PoolClient } from 'pg';
import { TxManager } from '../../database/tx-manager';
import { Qty, Rate, Money } from '../../types';

export interface OrderItemRequirementDto {
  yarnItemId: number;
  requiredQty: number;
}

export interface CreateOrderItemDto {
  productId: number;
  colourId: number;
  orderedQty: number;
  unitId: number;
  agreedRate: number;
  materialRequirements?: OrderItemRequirementDto[];
}

export interface CreateOrderDto {
  buyerId: number;
  orderDate?: string | Date;
  promisedDeliveryDate?: string | Date;
  items: CreateOrderItemDto[];
}

export interface ListOrdersQuery {
  buyerId?: number;
  status?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface MaterialCheckItem {
  orderId: number;
  orderNo: string;
  orderStatus: string;
  orderItemId: number;
  orderLineNo: number;
  fabricProductName: string;
  requirementId: number;
  yarnItemId: number;
  yarnTypeName: string;
  yarnColourName: string;
  requiredQty: number;
  unitCode: string;
  totalOnHandQty: number;
  totalReservedQty: number;
  unreservedAvailableQty: number;
  thisOrderReservedQty: number;
  feasibilityStatus: 'fully_reserved' | 'stock_available' | 'stock_deficit';
  shortageQty: number;
}

export interface MaterialCheckResponse {
  orderId: number;
  isFeasible: boolean;
  totalRequirementsCount: number;
  deficitCount: number;
  totalShortageQty: number;
  items: MaterialCheckItem[];
}

export class OrderService {
  /**
   * Create Customer Order in 'draft' status with line items and material requirements.
   */
  static async createOrder(
    dto: CreateOrderDto,
    userId: number
  ): Promise<{ order: any; items: any[] }> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'ORDER_CREATE',
        reason: `Create draft order for buyer ID: ${dto.buyerId}`,
      },
      async (client: PoolClient) => {
        // 1. Verify Buyer is active
        const buyerRes = await client.query(
          `SELECT buyer_id, name, is_active FROM buyer WHERE buyer_id = $1`,
          [dto.buyerId]
        );
        if (buyerRes.rowCount === 0) {
          throw new Error('BUYER_NOT_FOUND');
        }
        if (!buyerRes.rows[0].is_active) {
          throw new Error('BUYER_INACTIVE');
        }

        // 2. Insert customer_order header (draft)
        const orderRes = await client.query(
          `INSERT INTO customer_order (
             buyer_id, order_date, promised_delivery_date, status, version
           ) VALUES (
             $1, 
             COALESCE($2::date, (now() AT TIME ZONE 'Asia/Kolkata')::date),
             $3::date,
             'draft',
             1
           ) RETURNING order_id, order_no, buyer_id, order_date, promised_delivery_date, 
                       status, version, created_at, created_by`,
          [
            dto.buyerId,
            dto.orderDate || null,
            dto.promisedDeliveryDate || null,
          ]
        );

        const newOrder = orderRes.rows[0];
        const createdItems: any[] = [];

        // 3. Insert order_item lines and material requirements
        let lineNo = 1;
        for (const item of dto.items) {
          // Verify fabric product and unit match (enforces fk_order_item_product_unit)
          const productRes = await client.query(
            `SELECT product_id, name, unit_id, is_active 
               FROM fabric_product 
              WHERE product_id = $1 AND unit_id = $2`,
            [item.productId, item.unitId]
          );

          if (productRes.rowCount === 0) {
            throw new Error(`PRODUCT_UNIT_MISMATCH: Product ID ${item.productId} does not match Unit ID ${item.unitId}`);
          }
          if (!productRes.rows[0].is_active) {
            throw new Error(`PRODUCT_INACTIVE: Product ID ${item.productId} is inactive`);
          }

          const itemRes = await client.query(
            `INSERT INTO order_item (
               order_id, line_no, product_id, colour_id, ordered_qty, unit_id, agreed_rate
             ) VALUES (
               $1, $2, $3, $4, $5, $6, $7
             ) RETURNING order_item_id, order_id, line_no, product_id, colour_id, 
                         ordered_qty, unit_id, agreed_rate, created_at`,
            [
              newOrder.order_id,
              lineNo++,
              item.productId,
              item.colourId,
              item.orderedQty,
              item.unitId,
              item.agreedRate,
            ]
          );

          const createdItem = itemRes.rows[0];
          const requirements: any[] = [];

          // Insert material requirements if specified
          if (item.materialRequirements && item.materialRequirements.length > 0) {
            for (const req of item.materialRequirements) {
              const reqRes = await client.query(
                `INSERT INTO order_material_requirement (
                   order_item_id, yarn_item_id, required_qty
                 ) VALUES (
                   $1, $2, $3
                 ) RETURNING requirement_id, order_item_id, yarn_item_id, required_qty, created_at`,
                [createdItem.order_item_id, req.yarnItemId, req.requiredQty]
              );
              requirements.push(reqRes.rows[0]);
            }
          }

          createdItems.push({
            ...createdItem,
            requirements,
          });
        }

        return {
          order: newOrder,
          items: createdItems,
        };
      }
    );
  }

  /**
   * Check Material Feasibility (reads from view v_order_material_check)
   */
  static async checkMaterialFeasibility(orderId: number): Promise<MaterialCheckResponse> {
    const rows = await TxManager.query<any>(
      `SELECT order_id, order_no, order_status, order_item_id, order_line_no,
              fabric_product_name, requirement_id, yarn_item_id, yarn_type_name,
              yarn_colour_name, required_qty, unit_code, total_on_hand_qty,
              total_reserved_qty, unreserved_available_qty, this_order_reserved_qty,
              feasibility_status, shortage_qty
         FROM v_order_material_check
        WHERE order_id = $1
        ORDER BY order_line_no ASC, requirement_id ASC`,
      [orderId]
    );

    const items: MaterialCheckItem[] = rows.map(r => ({
      orderId: Number(r.order_id),
      orderNo: r.order_no,
      orderStatus: r.order_status,
      orderItemId: Number(r.order_item_id),
      orderLineNo: Number(r.order_line_no),
      fabricProductName: r.fabric_product_name,
      requirementId: Number(r.requirement_id),
      yarnItemId: Number(r.yarn_item_id),
      yarnTypeName: r.yarn_type_name,
      yarnColourName: r.yarn_colour_name,
      requiredQty: Number(r.required_qty),
      unitCode: r.unit_code,
      totalOnHandQty: Number(r.total_on_hand_qty),
      totalReservedQty: Number(r.total_reserved_qty),
      unreservedAvailableQty: Number(r.unreserved_available_qty),
      thisOrderReservedQty: Number(r.this_order_reserved_qty),
      feasibilityStatus: r.feasibility_status,
      shortageQty: Number(r.shortage_qty),
    }));

    const totalShortageQty = items.reduce((acc, curr) => acc + curr.shortageQty, 0);
    const deficitCount = items.filter(i => i.feasibilityStatus === 'stock_deficit').length;
    const isFeasible = items.length > 0 && deficitCount === 0;

    return {
      orderId,
      isFeasible,
      totalRequirementsCount: items.length,
      deficitCount,
      totalShortageQty,
      items,
    };
  }

  /**
   * WF-3: Confirm Customer Order with Optimistic Concurrency Control (OCC) and optional stock auto-reservation.
   */
  static async confirmOrder(
    orderId: number,
    expectedVersion: number,
    autoReserve: boolean,
    userId: number
  ): Promise<{ order: any; reservationsCreated: number }> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'ORDER_CONFIRM',
        reason: `Confirm order ID: ${orderId} (autoReserve: ${autoReserve})`,
      },
      async (client: PoolClient) => {
        // 1. Lock and retrieve order header
        const orderRes = await client.query(
          `SELECT order_id, order_no, buyer_id, promised_delivery_date, status, version 
             FROM customer_order 
            WHERE order_id = $1 
              FOR UPDATE`,
          [orderId]
        );

        if (orderRes.rowCount === 0) {
          throw new Error('ORDER_NOT_FOUND');
        }

        const order = orderRes.rows[0];

        // 2. OCC Version Check
        if (order.version !== expectedVersion) {
          throw new Error('CONCURRENT_MODIFICATION');
        }

        if (order.status !== 'draft') {
          throw new Error(`ORDER_NOT_IN_DRAFT: Current status is ${order.status}`);
        }

        // 3. Invariant check: Promised delivery date is mandatory upon confirmation (FR-4.3 / ck_order_confirmed_has_date)
        if (!order.promised_delivery_date) {
          throw new Error('MISSING_PROMISED_DELIVERY_DATE');
        }

        // 4. Invariant check: Order must have at least one line item
        const itemsCountRes = await client.query(
          `SELECT count(*) as count FROM order_item WHERE order_id = $1`,
          [orderId]
        );
        if (parseInt(itemsCountRes.rows[0].count, 10) === 0) {
          throw new Error('ORDER_HAS_NO_ITEMS');
        }

        let reservationsCreated = 0;

        // 5. Auto-reserve stock if requested
        if (autoReserve) {
          // Fetch requirements that do not already have active reservations
          const reqs = await client.query(
            `SELECT omr.requirement_id, omr.yarn_item_id, omr.required_qty,
                    COALESCE(sb.on_hand_qty, 0) - COALESCE(sb.reserved_qty, 0) AS available_qty
               FROM order_material_requirement omr
               JOIN order_item oi ON omr.order_item_id = oi.order_item_id
               JOIN yarn_stock_balance sb ON omr.yarn_item_id = sb.yarn_item_id
              WHERE oi.order_id = $1
                AND NOT EXISTS (
                  SELECT 1 FROM yarn_reservation yr 
                   WHERE yr.requirement_id = omr.requirement_id AND yr.status = 'active'
                )
              ORDER BY omr.yarn_item_id ASC
                FOR UPDATE OF sb`,
            [orderId]
          );

          for (const req of reqs.rows) {
            const available = Math.max(0, Number(req.available_qty));
            const needed = Number(req.required_qty);
            const reserveQty = Math.min(needed, available);

            if (reserveQty > 0) {
              await client.query(
                `INSERT INTO yarn_reservation (
                   requirement_id, reserved_qty, status
                 ) VALUES (
                   $1, $2, 'active'
                 )`,
                [req.requirement_id, reserveQty]
              );
              reservationsCreated++;
            }
          }
        }

        // 6. Transition Order Status to 'confirmed'
        // This fires trg_order_before (sets confirmed_at = now()) and trg_order_history_upd
        const updatedRes = await client.query(
          `UPDATE customer_order 
              SET status = 'confirmed',
                  version = version + 1,
                  updated_at = now()
            WHERE order_id = $1
        RETURNING order_id, order_no, buyer_id, order_date, promised_delivery_date, 
                   status, confirmed_at, version, updated_at`,
          [orderId]
        );

        return {
          order: updatedRes.rows[0],
          reservationsCreated,
        };
      }
    );
  }

  /**
   * WF-3c: Cancel Customer Order.
   * Releases active yarn reservations and verifies no running jobs or issued invoices exist.
   */
  static async cancelOrder(
    orderId: number,
    cancelReason: string,
    userId: number
  ): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'ORDER_CANCEL',
        reason: `Cancel customer order ID: ${orderId}. Reason: ${cancelReason}`,
      },
      async (client: PoolClient) => {
        // 1. Lock and verify order
        const orderRes = await client.query(
          `SELECT order_id, order_no, status, version 
             FROM customer_order 
            WHERE order_id = $1 
              FOR UPDATE`,
          [orderId]
        );

        if (orderRes.rowCount === 0) {
          throw new Error('ORDER_NOT_FOUND');
        }

        const order = orderRes.rows[0];

        if (order.status === 'cancelled') {
          throw new Error('ORDER_ALREADY_CANCELLED');
        }
        if (order.status === 'closed') {
          throw new Error('ORDER_ALREADY_CLOSED');
        }

        // 2. Release all active yarn reservations for this order
        // This triggers trg_reservation_apply_upd which adjusts yarn_stock_balance.reserved_qty
        await client.query(
          `UPDATE yarn_reservation 
              SET status = 'released',
                  closed_at = now(),
                  updated_at = now()
            WHERE requirement_id IN (
              SELECT omr.requirement_id 
                FROM order_material_requirement omr
                JOIN order_item oi ON omr.order_item_id = oi.order_item_id
               WHERE oi.order_id = $1
            )
            AND status = 'active'`,
          [orderId]
        );

        // 3. Update customer_order status to 'cancelled'
        // This triggers trg_order_before (verifies no active jobs/dispatches/invoices)
        // and trg_order_history_upd (records cancellation reason)
        const updatedRes = await client.query(
          `UPDATE customer_order 
              SET status = 'cancelled',
                  cancel_reason = $1,
                  version = version + 1,
                  updated_at = now()
            WHERE order_id = $2
        RETURNING order_id, order_no, status, cancelled_at, cancelled_by, cancel_reason, version, updated_at`,
          [cancelReason.trim(), orderId]
        );

        return updatedRes.rows[0];
      }
    );
  }

  /**
   * Get Full Order Structure by ID
   */
  static async getOrderById(orderId: number): Promise<any> {
    const order = await TxManager.queryOne<any>(
      `SELECT co.order_id, co.order_no, co.buyer_id, b.name AS buyer_name, b.contact AS buyer_contact,
              b.tax_id AS buyer_tax_id, co.order_date, co.promised_delivery_date, co.status,
              co.confirmed_at, co.cancelled_at, co.cancelled_by, u_canc.username AS cancelled_by_username,
              co.cancel_reason, co.version, co.created_at, co.created_by, u_cre.username AS created_by_username,
              co.updated_at
         FROM customer_order co
         JOIN buyer b ON co.buyer_id = b.buyer_id
    LEFT JOIN app_user u_cre ON co.created_by = u_cre.user_id
    LEFT JOIN app_user u_canc ON co.cancelled_by = u_canc.user_id
        WHERE co.order_id = $1`,
      [orderId]
    );

    if (!order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    // Fetch line items
    const items = await TxManager.query<any>(
      `SELECT oi.order_item_id, oi.order_id, oi.line_no, oi.product_id, fp.name AS product_name,
              oi.colour_id, c.name AS colour_name, oi.ordered_qty, oi.unit_id, u.unit_code,
              oi.agreed_rate, ROUND(oi.ordered_qty * oi.agreed_rate, 2) AS line_total,
              oi.created_at
         FROM order_item oi
         JOIN fabric_product fp ON oi.product_id = fp.product_id
         JOIN colour c ON oi.colour_id = c.colour_id
         JOIN unit_of_measure u ON oi.unit_id = u.unit_id
        WHERE oi.order_id = $1
        ORDER BY oi.line_no ASC`,
      [orderId]
    );

    // Fetch material requirements & reservations
    const requirements = await TxManager.query<any>(
      `SELECT omr.requirement_id, omr.order_item_id, omr.yarn_item_id,
              yt.name AS yarn_type_name, c.name AS colour_name, omr.required_qty, u.unit_code,
              yr.reservation_id, yr.reserved_qty, yr.status AS reservation_status
         FROM order_material_requirement omr
         JOIN order_item oi ON omr.order_item_id = oi.order_item_id
         JOIN yarn_item yi ON omr.yarn_item_id = yi.yarn_item_id
         JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
         JOIN colour c ON yi.colour_id = c.colour_id
         JOIN unit_of_measure u ON yi.unit_id = u.unit_id
    LEFT JOIN yarn_reservation yr ON omr.requirement_id = yr.requirement_id AND yr.status = 'active'
        WHERE oi.order_id = $1
        ORDER BY omr.order_item_id ASC, omr.requirement_id ASC`,
      [orderId]
    );

    // Fetch order status history
    const history = await TxManager.query<any>(
      `SELECT osh.history_id, osh.from_status, osh.to_status, osh.reason,
              osh.changed_at, u.username AS changed_by_username
         FROM order_status_history osh
    LEFT JOIN app_user u ON osh.changed_by = u.user_id
        WHERE osh.order_id = $1
        ORDER BY osh.changed_at ASC`,
      [orderId]
    );

    return {
      ...order,
      items: items.map(item => ({
        ...item,
        requirements: requirements.filter(r => r.order_item_id === item.order_item_id),
      })),
      history,
    };
  }

  /**
   * List Customer Orders with operational stage progress (reads from view v_order_status)
   */
  static async listOrders(query: ListOrdersQuery): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (query.buyerId) {
      conditions.push(`buyer_id = $${paramIdx++}`);
      values.push(query.buyerId);
    }
    if (query.status) {
      conditions.push(`commercial_status = $${paramIdx++}`);
      values.push(query.status);
    }
    if (query.fromDate) {
      conditions.push(`order_date >= $${paramIdx++}`);
      values.push(query.fromDate);
    }
    if (query.toDate) {
      conditions.push(`order_date <= $${paramIdx++}`);
      values.push(query.toDate);
    }
    if (query.search) {
      conditions.push(`(order_no ILIKE $${paramIdx} OR buyer_name ILIKE $${paramIdx} OR buyer_contact ILIKE $${paramIdx})`);
      values.push(`%${query.search.trim()}%`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await TxManager.queryOne<{ count: string }>(
      `SELECT count(*) as count FROM v_order_status ${whereClause}`,
      values
    );
    const total = parseInt(countRes?.count || '0', 10);

    const rows = await TxManager.query<any>(
      `SELECT * FROM v_order_status
       ${whereClause}
        ORDER BY order_date DESC, order_id DESC
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
   * High-Performance Buyer Phone Inquiry Lookup (<10ms target leveraging index idx_customer_order_buyer_date)
   */
  static async phoneLookup(query: string): Promise<any[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    return await TxManager.query<any>(
      `SELECT vos.order_id, vos.order_no, vos.buyer_id, vos.buyer_name, vos.buyer_contact,
              vos.order_date, vos.promised_delivery_date, vos.commercial_status,
              vos.operational_stage, vos.production_completion_pct, vos.total_ordered_qty,
              vos.total_produced_m, vos.passed_qc_m, vos.dispatched_m
         FROM v_order_status vos
        WHERE vos.buyer_contact ILIKE $1 
           OR vos.buyer_name ILIKE $1 
           OR vos.order_no ILIKE $1
        ORDER BY vos.order_date DESC
        LIMIT 20`,
      [`%${trimmed}%`]
    );
  }
}
