import { PoolClient } from 'pg';
import { TxManager } from '../../database/tx-manager';
import { Qty, Rate, Money } from '../../types';

export interface CreateGateReceiptItemDto {
  yarnItemId: number;
  quantityReceived: number;
  challanQuantity?: number;
  unitRate?: number;
  earmarkedOrderId?: number;
}

export interface CreateGateReceiptDto {
  supplierId: number;
  supplierChallanNo?: string;
  poId?: number;
  receivedAt?: string | Date;
  clientRequestId: string;
  items: CreateGateReceiptItemDto[];
}

export interface ListReceiptsQuery {
  supplierId?: number;
  poId?: number;
  status?: 'received' | 'cancelled';
  fromReceivedAt?: string;
  toReceivedAt?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface YarnStockQuery {
  isLowStock?: boolean;
  yarnTypeId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ThermalBarcodePayload {
  lotCode: string;
  receiptId: number;
  receiptNo: string;
  receivedAt: string;
  supplierId: number;
  supplierName: string;
  supplierChallanNo: string | null;
  yarnItemId: number;
  yarnTypeName: string;
  colourName: string;
  quantityReceived: number;
  unitCode: string;
  earmarkedOrderId: number | null;
  earmarkedOrderNo: string | null;
  barcodeData: string;
  qrData: string;
  zplCode: string;
}

export class RawMaterialService {
  /**
   * WF-1: Create Gate Inward Receipt with multiple yarn lots
   * Atomic stock update via PostgreSQL database triggers.
   * Idempotency protected with client_request_id.
   */
  static async createGateReceipt(
    dto: CreateGateReceiptDto,
    userId: number
  ): Promise<{ receipt: any; items: any[]; isIdempotentRetry: boolean }> {
    // 1. Check idempotency: If client_request_id already exists, return existing receipt
    const existing = await TxManager.queryOne<any>(
      `SELECT receipt_id, receipt_no, supplier_id, po_id, supplier_challan_no, 
              received_at, client_request_id, status, created_at, created_by 
         FROM goods_receipt 
        WHERE client_request_id = $1`,
      [dto.clientRequestId]
    );

    if (existing) {
      const items = await TxManager.query<any>(
        `SELECT gri.receipt_item_id, gri.receipt_id, gri.lot_code, gri.yarn_item_id,
                yt.name AS yarn_type_name, c.name AS colour_name, u.unit_code,
                gri.quantity_received, gri.challan_quantity, gri.unit_rate,
                gri.earmarked_order_id, co.order_no AS earmarked_order_no,
                gri.created_at
           FROM goods_receipt_item gri
           JOIN yarn_item yi ON gri.yarn_item_id = yi.yarn_item_id
           JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
           JOIN colour c ON yi.colour_id = c.colour_id
           JOIN unit_of_measure u ON yi.unit_id = u.unit_id
      LEFT JOIN customer_order co ON gri.earmarked_order_id = co.order_id
          WHERE gri.receipt_id = $1
          ORDER BY gri.receipt_item_id ASC`,
        [existing.receipt_id]
      );

      return {
        receipt: existing,
        items,
        isIdempotentRetry: true,
      };
    }

    // 2. Perform Atomic Gate Inward Creation
    return await TxManager.withTransaction(
      {
        userId,
        source: 'GATE_INWARD',
        reason: `Gate inward receipt creation for supplier ID: ${dto.supplierId}, challan: ${dto.supplierChallanNo || 'N/A'}`,
      },
      async (client: PoolClient) => {
        // Validate Supplier existence
        const supplier = await client.query(
          `SELECT supplier_id, name, is_active FROM supplier WHERE supplier_id = $1`,
          [dto.supplierId]
        );
        if (supplier.rowCount === 0) {
          throw new Error('SUPPLIER_NOT_FOUND');
        }
        if (!supplier.rows[0].is_active) {
          throw new Error('SUPPLIER_INACTIVE');
        }

        // Validate PO if provided
        if (dto.poId) {
          const po = await client.query(
            `SELECT po_id, supplier_id, status FROM purchase_order WHERE po_id = $1`,
            [dto.poId]
          );
          if (po.rowCount === 0) {
            throw new Error('PURCHASE_ORDER_NOT_FOUND');
          }
          if (Number(po.rows[0].supplier_id) !== Number(dto.supplierId)) {
            throw new Error('PO_SUPPLIER_MISMATCH');
          }
          if (po.rows[0].status === 'cancelled' || po.rows[0].status === 'closed') {
            throw new Error('PURCHASE_ORDER_NOT_ACTIVE');
          }
        }

        // Insert Header: goods_receipt
        const receiptRes = await client.query(
          `INSERT INTO goods_receipt (
             supplier_id, po_id, supplier_challan_no, received_at, client_request_id, status
           ) VALUES (
             $1, $2, $3, COALESCE($4::timestamptz, now()), $5, 'received'
           ) RETURNING receipt_id, receipt_no, supplier_id, po_id, supplier_challan_no, 
                       received_at, client_request_id, status, created_at, created_by`,
          [
            dto.supplierId,
            dto.poId || null,
            dto.supplierChallanNo ? dto.supplierChallanNo.trim() : null,
            dto.receivedAt || null,
            dto.clientRequestId,
          ]
        );

        const newReceipt = receiptRes.rows[0];

        // Sort items by yarn_item_id to ensure deterministic locking order
        const sortedItems = [...dto.items].sort((a, b) => a.yarnItemId - b.yarnItemId);
        const createdItems: any[] = [];

        // Insert goods_receipt_item rows. Each insert automatically fires:
        // 1. trg_receipt_item_before (enforces creation within same transaction)
        // 2. trg_receipt_item_post (generates yarn_stock_movement)
        // 3. trg_movement_apply (updates yarn_stock_balance and stock_alert)
        for (const item of sortedItems) {
          const itemRes = await client.query(
            `INSERT INTO goods_receipt_item (
               receipt_id, yarn_item_id, quantity_received, challan_quantity, unit_rate, earmarked_order_id
             ) VALUES (
               $1, $2, $3, $4, $5, $6
             ) RETURNING receipt_item_id, receipt_id, lot_code, yarn_item_id, 
                         quantity_received, challan_quantity, unit_rate, earmarked_order_id, created_at`,
            [
              newReceipt.receipt_id,
              item.yarnItemId,
              item.quantityReceived,
              item.challanQuantity || null,
              item.unitRate !== undefined ? item.unitRate : null,
              item.earmarkedOrderId || null,
            ]
          );

          createdItems.push(itemRes.rows[0]);
        }

        return {
          receipt: newReceipt,
          items: createdItems,
          isIdempotentRetry: false,
        };
      }
    );
  }

  /**
   * WF-2: Cancel Gate Receipt
   * Reverses stock movements atomically via database triggers.
   */
  static async cancelGateReceipt(
    receiptId: number,
    cancelReason: string,
    userId: number
  ): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'GATE_RECEIPT_CANCEL',
        reason: `Cancel goods receipt ID: ${receiptId}. Reason: ${cancelReason}`,
      },
      async (client: PoolClient) => {
        // 1. Lock and fetch receipt
        const receiptRes = await client.query(
          `SELECT receipt_id, receipt_no, status, supplier_id 
             FROM goods_receipt 
            WHERE receipt_id = $1 
              FOR UPDATE`,
          [receiptId]
        );

        if (receiptRes.rowCount === 0) {
          throw new Error('RECEIPT_NOT_FOUND');
        }

        const receipt = receiptRes.rows[0];

        if (receipt.status === 'cancelled') {
          throw new Error('RECEIPT_ALREADY_CANCELLED');
        }

        // 2. Invariant Check: Check if any lot on this receipt is already referenced in an active supplier bill
        const billCheck = await client.query(
          `SELECT sbl.bill_line_id, sb.bill_id, sb.supplier_bill_no
             FROM supplier_bill_line sbl
             JOIN supplier_bill sb ON sbl.bill_id = sb.bill_id
             JOIN goods_receipt_item gri ON sbl.receipt_item_id = gri.receipt_item_id
            WHERE gri.receipt_id = $1 AND sb.status = 'recorded'
            LIMIT 1`,
          [receiptId]
        );

        if (billCheck.rowCount && billCheck.rowCount > 0) {
          throw new Error('CANNOT_CANCEL_BILLED_RECEIPT');
        }

        // 3. Update status to 'cancelled'. This fires trg_receipt_cancel which posts reversal movements.
        // If stock has been consumed and would drop below zero, trg_movement_apply triggers ck_balance_not_negative.
        const updatedRes = await client.query(
          `UPDATE goods_receipt 
              SET status = 'cancelled', 
                  cancel_reason = $1 
            WHERE receipt_id = $2 
        RETURNING receipt_id, receipt_no, status, cancelled_at, cancelled_by, cancel_reason, updated_at`,
          [cancelReason.trim(), receiptId]
        );

        return updatedRes.rows[0];
      }
    );
  }

  /**
   * Fetch Single Receipt by ID with full item and supplier details
   */
  static async getReceiptById(receiptId: number): Promise<any> {
    const receipt = await TxManager.queryOne<any>(
      `SELECT gr.receipt_id, gr.receipt_no, gr.supplier_id, s.name AS supplier_name, s.supplier_code,
              gr.po_id, po.po_no, gr.supplier_challan_no, gr.received_at, gr.client_request_id,
              gr.status, gr.cancelled_at, gr.cancelled_by, u_canc.username AS cancelled_by_username,
              gr.cancel_reason, gr.created_at, gr.created_by, u_cre.username AS created_by_username
         FROM goods_receipt gr
         JOIN supplier s ON gr.supplier_id = s.supplier_id
    LEFT JOIN purchase_order po ON gr.po_id = po.po_id
    LEFT JOIN app_user u_cre ON gr.created_by = u_cre.user_id
    LEFT JOIN app_user u_canc ON gr.cancelled_by = u_canc.user_id
        WHERE gr.receipt_id = $1`,
      [receiptId]
    );

    if (!receipt) {
      throw new Error('RECEIPT_NOT_FOUND');
    }

    const items = await TxManager.query<any>(
      `SELECT gri.receipt_item_id, gri.receipt_id, gri.lot_code, gri.yarn_item_id,
              yt.name AS yarn_type_name, c.name AS colour_name, u.unit_code,
              gri.quantity_received, gri.challan_quantity, gri.unit_rate,
              ROUND(gri.quantity_received * COALESCE(gri.unit_rate, 0), 2) AS line_total,
              gri.earmarked_order_id, co.order_no AS earmarked_order_no,
              gri.created_at
         FROM goods_receipt_item gri
         JOIN yarn_item yi ON gri.yarn_item_id = yi.yarn_item_id
         JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
         JOIN colour c ON yi.colour_id = c.colour_id
         JOIN unit_of_measure u ON yi.unit_id = u.unit_id
    LEFT JOIN customer_order co ON gri.earmarked_order_id = co.order_id
        WHERE gri.receipt_id = $1
        ORDER BY gri.receipt_item_id ASC`,
      [receiptId]
    );

    return {
      ...receipt,
      items,
    };
  }

  /**
   * List Receipts with pagination and filters
   */
  static async listReceipts(query: ListReceiptsQuery): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (query.supplierId) {
      conditions.push(`gr.supplier_id = $${paramIdx++}`);
      values.push(query.supplierId);
    }
    if (query.poId) {
      conditions.push(`gr.po_id = $${paramIdx++}`);
      values.push(query.poId);
    }
    if (query.status) {
      conditions.push(`gr.status = $${paramIdx++}`);
      values.push(query.status);
    }
    if (query.fromReceivedAt) {
      conditions.push(`gr.received_at >= $${paramIdx++}`);
      values.push(query.fromReceivedAt);
    }
    if (query.toReceivedAt) {
      conditions.push(`gr.received_at <= $${paramIdx++}`);
      values.push(query.toReceivedAt);
    }
    if (query.search) {
      conditions.push(`(gr.receipt_no ILIKE $${paramIdx} OR gr.supplier_challan_no ILIKE $${paramIdx} OR s.name ILIKE $${paramIdx})`);
      values.push(`%${query.search.trim()}%`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await TxManager.queryOne<{ count: string }>(
      `SELECT count(*) as count 
         FROM goods_receipt gr
         JOIN supplier s ON gr.supplier_id = s.supplier_id
       ${whereClause}`,
      values
    );
    const total = parseInt(countRes?.count || '0', 10);

    const rows = await TxManager.query<any>(
      `SELECT gr.receipt_id, gr.receipt_no, gr.supplier_id, s.name AS supplier_name,
              gr.po_id, gr.supplier_challan_no, gr.received_at, gr.status,
              gr.created_at, u.username AS created_by_username,
              COUNT(gri.receipt_item_id)::int AS item_count,
              COALESCE(SUM(gri.quantity_received), 0) AS total_quantity_received
         FROM goods_receipt gr
         JOIN supplier s ON gr.supplier_id = s.supplier_id
    LEFT JOIN app_user u ON gr.created_by = u.user_id
    LEFT JOIN goods_receipt_item gri ON gr.receipt_id = gri.receipt_id
       ${whereClause}
        GROUP BY gr.receipt_id, gr.receipt_no, gr.supplier_id, s.name, gr.po_id, 
                 gr.supplier_challan_no, gr.received_at, gr.status, gr.created_at, u.username
        ORDER BY gr.received_at DESC, gr.receipt_id DESC
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
   * Query Yarn Stock Inventory (reads from view v_yarn_stock)
   */
  static async getYarnStock(query: YarnStockQuery): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 25));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (query.isLowStock !== undefined) {
      conditions.push(`is_low_stock = $${paramIdx++}`);
      values.push(query.isLowStock);
    }
    if (query.yarnTypeId) {
      conditions.push(`yi.yarn_type_id = $${paramIdx++}`);
      values.push(query.yarnTypeId);
    }
    if (query.search) {
      conditions.push(`(yarn_type_name ILIKE $${paramIdx} OR colour_name ILIKE $${paramIdx})`);
      values.push(`%${query.search.trim()}%`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await TxManager.queryOne<{ count: string }>(
      `SELECT count(*) as count 
         FROM v_yarn_stock vs
         JOIN yarn_item yi ON vs.yarn_item_id = yi.yarn_item_id
       ${whereClause}`,
      values
    );
    const total = parseInt(countRes?.count || '0', 10);

    const rows = await TxManager.query<any>(
      `SELECT vs.*
         FROM v_yarn_stock vs
         JOIN yarn_item yi ON vs.yarn_item_id = yi.yarn_item_id
       ${whereClause}
        ORDER BY vs.is_low_stock DESC, vs.yarn_type_name ASC, vs.colour_name ASC
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
   * Get Open Low-Stock Alerts (reads from view v_open_stock_alerts)
   */
  static async getOpenStockAlerts(): Promise<any[]> {
    return await TxManager.query<any>(
      `SELECT * FROM v_open_stock_alerts ORDER BY opened_at DESC`
    );
  }

  /**
   * Acknowledge Low Stock Alert
   */
  static async acknowledgeStockAlert(alertId: number, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'STOCK_ALERT_ACK',
        reason: `Acknowledge stock alert ID: ${alertId}`,
      },
      async (client: PoolClient) => {
        const check = await client.query(
          `SELECT alert_id, yarn_item_id, status FROM stock_alert WHERE alert_id = $1`,
          [alertId]
        );

        if (check.rowCount === 0) {
          throw new Error('ALERT_NOT_FOUND');
        }

        if (check.rows[0].status === 'acknowledged') {
          throw new Error('ALERT_ALREADY_ACKNOWLEDGED');
        }

        if (check.rows[0].status === 'resolved') {
          throw new Error('ALERT_ALREADY_RESOLVED');
        }

        const res = await client.query(
          `UPDATE stock_alert
              SET status = 'acknowledged',
                  acknowledged_at = now(),
                  acknowledged_by = $1
            WHERE alert_id = $2
        RETURNING alert_id, yarn_item_id, status, balance_at_trigger, opened_at, acknowledged_at, acknowledged_by`,
          [userId, alertId]
        );

        return res.rows[0];
      }
    );
  }

  /**
   * Query Unbilled Yarn Lots (reads from view v_unbilled_lots)
   */
  static async getUnbilledLots(supplierId?: number): Promise<any[]> {
    if (supplierId) {
      return await TxManager.query<any>(
        `SELECT * FROM v_unbilled_lots WHERE supplier_id = $1 ORDER BY received_at DESC, receipt_no, lot_code`,
        [supplierId]
      );
    }
    return await TxManager.query<any>(
      `SELECT * FROM v_unbilled_lots ORDER BY received_at DESC, supplier_name, lot_code`
    );
  }

  /**
   * Fetch Thermal Barcode Label Payload and ZPL II printing command for a Yarn Lot
   */
  static async getLotBarcodePayload(lotCode: string): Promise<ThermalBarcodePayload> {
    const lot = await TxManager.queryOne<any>(
      `SELECT gri.receipt_item_id, gri.lot_code, gri.quantity_received, gri.unit_rate,
              gr.receipt_id, gr.receipt_no, gr.received_at, gr.supplier_challan_no,
              s.supplier_id, s.name AS supplier_name,
              yi.yarn_item_id, yt.name AS yarn_type_name, c.name AS colour_name, u.unit_code,
              gri.earmarked_order_id, co.order_no AS earmarked_order_no
         FROM goods_receipt_item gri
         JOIN goods_receipt gr ON gri.receipt_id = gr.receipt_id
         JOIN supplier s ON gr.supplier_id = s.supplier_id
         JOIN yarn_item yi ON gri.yarn_item_id = yi.yarn_item_id
         JOIN yarn_type yt ON yi.yarn_type_id = yt.yarn_type_id
         JOIN colour c ON yi.colour_id = c.colour_id
         JOIN unit_of_measure u ON yi.unit_id = u.unit_id
    LEFT JOIN customer_order co ON gri.earmarked_order_id = co.order_id
        WHERE gri.lot_code = $1`,
      [lotCode.trim().toUpperCase()]
    );

    if (!lot) {
      throw new Error('LOT_NOT_FOUND');
    }

    const receivedDate = new Date(lot.received_at).toLocaleDateString('en-GB');
    const barcodeData = lot.lot_code;
    const qrData = JSON.stringify({
      lot: lot.lot_code,
      grn: lot.receipt_no,
      yarn: `${lot.yarn_type_name} - ${lot.colour_name}`,
      qty: `${lot.quantity_received} ${lot.unit_code}`,
      supp: lot.supplier_name,
      dt: receivedDate,
    });

    // Generate Industrial ZPL II Command (4x2 inch / 203 DPI label)
    const zplCode = [
      '^XA',
      '^PW812',                    // Print width: 812 dots (4 inches @ 203 dpi)
      '^LL406',                    // Label length: 406 dots (2 inches @ 203 dpi)
      '^LH0,0',
      // Header: Mill Name & Lot Code
      '^FO40,30^A0N,28,28^FDEVEREST TEXTILE MILLS - YARN LOT^FS',
      `^FO40,65^A0N,36,36^FD${lot.lot_code}^FS`,
      // 1D Code 128 Barcode
      `^FO40,110^BCN,60,Y,N,N^FD${lot.lot_code}^FS`,
      // Right Side Information
      `^FO480,40^A0N,24,24^FDYarn: ${lot.yarn_type_name}^FS`,
      `^FO480,75^A0N,24,24^FDColour: ${lot.colour_name}^FS`,
      `^FO480,110^A0N,28,28^FDQty: ${Number(lot.quantity_received).toFixed(2)} ${lot.unit_code}^FS`,
      `^FO480,145^A0N,22,22^FDGRN: ${lot.receipt_no}^FS`,
      `^FO480,175^A0N,20,20^FDSupplier: ${lot.supplier_name.substring(0, 20)}^FS`,
      `^FO480,205^A0N,20,20^FDDate: ${receivedDate}^FS`,
      lot.earmarked_order_no ? `^FO480,235^A0N,20,20^FDEarmarked: ${lot.earmarked_order_no}^FS` : '',
      // 2D QR Code on Bottom Left
      `^FO40,200^BQN,2,4^FDQA,${qrData}^FS`,
      '^XZ',
    ].filter(Boolean).join('\n');

    return {
      lotCode: lot.lot_code,
      receiptId: Number(lot.receipt_id),
      receiptNo: lot.receipt_no,
      receivedAt: lot.received_at,
      supplierId: Number(lot.supplier_id),
      supplierName: lot.supplier_name,
      supplierChallanNo: lot.supplier_challan_no,
      yarnItemId: Number(lot.yarn_item_id),
      yarnTypeName: lot.yarn_type_name,
      colourName: lot.colour_name,
      quantityReceived: Number(lot.quantity_received),
      unitCode: lot.unit_code,
      earmarkedOrderId: lot.earmarked_order_id ? Number(lot.earmarked_order_id) : null,
      earmarkedOrderNo: lot.earmarked_order_no || null,
      barcodeData,
      qrData,
      zplCode,
    };
  }
}
