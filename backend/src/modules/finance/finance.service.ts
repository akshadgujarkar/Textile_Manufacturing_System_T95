import { PoolClient } from 'pg';
import { TxManager } from '../../database/tx-manager';
import { Money, Rate, Qty } from '../../types';

export interface SupplierBillLineDto {
  receiptItemId: number;
  quantity: number;
  rate: number;
}

export interface CreateSupplierBillDto {
  supplierId: number;
  supplierBillNo: string;
  billDate: string | Date;
  lines: SupplierBillLineDto[];
}

export interface PaymentAllocationDto {
  invoiceId: number;
  amount: number;
}

export interface RecordBuyerPaymentDto {
  buyerId: number;
  receivedOn: string | Date;
  amount: number;
  mode: 'cash' | 'cheque' | 'bank_transfer' | 'upi' | 'other';
  instrumentRef?: string;
  clientRequestId: string;
  allocations?: PaymentAllocationDto[];
}

export class FinanceService {
  /**
   * WF-10b: Generate Sales Invoice from Dispatched Manifest
   * Aggregates active dispatch lines from v_dispatch_lines and creates draft invoice.
   */
  static async generateInvoiceFromDispatch(
    dispatchId: number,
    userId: number
  ): Promise<{ invoice: any; items: any[] }> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'INVOICE_GENERATE',
        reason: `Generate sales invoice from dispatch ID: ${dispatchId}`,
      },
      async (client: PoolClient) => {
        // 1. Lock and verify dispatch
        const dspRes = await client.query(
          `SELECT dispatch_id, dispatch_no, buyer_id, order_id, invoice_id, status 
             FROM dispatch 
            WHERE dispatch_id = $1 
              FOR UPDATE`,
          [dispatchId]
        );

        if (dspRes.rowCount === 0) {
          throw new Error('DISPATCH_NOT_FOUND');
        }

        const dsp = dspRes.rows[0];

        if (dsp.status !== 'dispatched') {
          throw new Error(`DISPATCH_NOT_SENT: Dispatch is "${dsp.status}". Only dispatched manifests can be invoiced.`);
        }

        if (dsp.invoice_id) {
          throw new Error(`DISPATCH_ALREADY_INVOICED: Dispatch is already linked to invoice ID ${dsp.invoice_id}.`);
        }

        // 2. Fetch aggregated dispatch lines
        const linesRes = await client.query(
          `SELECT * FROM v_dispatch_lines WHERE dispatch_id = $1`,
          [dispatchId]
        );

        if (linesRes.rowCount === 0) {
          throw new Error('NO_DISPATCH_LINES: No active loaded lines found on this dispatch.');
        }

        // 3. Insert Invoice Header (draft)
        const invRes = await client.query(
          `INSERT INTO invoice (
             buyer_id, invoice_date, status, version
           ) VALUES (
             $1, (now() AT TIME ZONE 'Asia/Kolkata')::date, 'draft', 1
           ) RETURNING invoice_id, invoice_no, buyer_id, invoice_date, total_amount, status, version, created_at`,
          [dsp.buyer_id]
        );

        const newInvoice = invRes.rows[0];
        const createdItems: any[] = [];

        // 4. Insert Invoice Item lines
        for (const line of linesRes.rows) {
          const itemRes = await client.query(
            `INSERT INTO invoice_item (
               invoice_id, order_item_id, quantity, rate, amount
             ) VALUES (
               $1, $2, $3, $4, round($3 * $4, 2)
             ) RETURNING invoice_item_id, invoice_id, order_item_id, quantity, rate, amount, created_at`,
            [
              newInvoice.invoice_id,
              line.order_item_id,
              line.total_length_m,
              line.agreed_rate,
            ]
          );
          createdItems.push(itemRes.rows[0]);
        }

        // 5. Link invoice to dispatch
        await client.query(
          `UPDATE dispatch SET invoice_id = $1, updated_at = now() WHERE dispatch_id = $2`,
          [newInvoice.invoice_id, dispatchId]
        );

        // Fetch refreshed invoice with updated total_amount
        const finalInv = await client.query(
          `SELECT * FROM invoice WHERE invoice_id = $1`,
          [newInvoice.invoice_id]
        );

        return {
          invoice: finalInv.rows[0],
          items: createdItems,
        };
      }
    );
  }

  /**
   * WF-11: Issue Sales Invoice
   * Locks sequence and assigns gap-free tax invoice number per fiscal year (April–March).
   */
  static async issueInvoice(invoiceId: number, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'INVOICE_ISSUE',
        reason: `Issue sales invoice ID: ${invoiceId}`,
      },
      async (client: PoolClient) => {
        // Lock invoice
        const invRes = await client.query(
          `SELECT invoice_id, status, invoice_date, version FROM invoice WHERE invoice_id = $1 FOR UPDATE`,
          [invoiceId]
        );

        if (invRes.rowCount === 0) {
          throw new Error('INVOICE_NOT_FOUND');
        }

        const inv = invRes.rows[0];
        if (inv.status !== 'draft') {
          throw new Error(`INVALID_INVOICE_STATUS: Cannot issue invoice with status "${inv.status}".`);
        }

        // Update status to 'issued'. This fires trg_invoice_before which automatically:
        // - Checks open accounting period via period_for(invoice_date)
        // - Generates gap-free invoice_no via next_doc_no('INV', invoice_date)
        // - Sets issued_at = now()
        const updatedRes = await client.query(
          `UPDATE invoice 
              SET status = 'issued',
                  version = version + 1,
                  updated_at = now()
            WHERE invoice_id = $1
        RETURNING invoice_id, invoice_no, buyer_id, invoice_date, total_amount, status, issued_at, version, updated_at`,
          [invoiceId]
        );

        return updatedRes.rows[0];
      }
    );
  }

  /**
   * Void Sales Invoice
   */
  static async voidInvoice(invoiceId: number, reason: string, userId: number): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'INVOICE_VOID',
        reason: `Void sales invoice ID: ${invoiceId}. Reason: ${reason}`,
      },
      async (client: PoolClient) => {
        const invRes = await client.query(
          `SELECT invoice_id, status FROM invoice WHERE invoice_id = $1 FOR UPDATE`,
          [invoiceId]
        );

        if (invRes.rowCount === 0) {
          throw new Error('INVOICE_NOT_FOUND');
        }

        const inv = invRes.rows[0];
        if (inv.status === 'void') {
          throw new Error('INVOICE_ALREADY_VOID');
        }

        // Update invoice to void (triggers trg_invoice_before to check dispatches & payments)
        const updatedRes = await client.query(
          `UPDATE invoice 
              SET status = 'void',
                  void_reason = $1,
                  version = version + 1,
                  updated_at = now()
            WHERE invoice_id = $2
        RETURNING invoice_id, invoice_no, status, voided_at, voided_by, void_reason, version, updated_at`,
          [reason.trim(), invoiceId]
        );

        return updatedRes.rows[0];
      }
    );
  }

  /**
   * Query Outstanding Invoice Balances (reads from view v_invoice_balance)
   */
  static async getInvoiceBalances(buyerId?: number): Promise<any[]> {
    if (buyerId) {
      return await TxManager.query<any>(
        `SELECT * FROM v_invoice_balance WHERE buyer_id = $1 ORDER BY invoice_date DESC, invoice_id DESC`,
        [buyerId]
      );
    }
    return await TxManager.query<any>(
      `SELECT * FROM v_invoice_balance ORDER BY invoice_date DESC, invoice_id DESC`
    );
  }

  /**
   * WF-12: Record Supplier Purchase Bill
   * Matches bill lines to goods_receipt_item lots and records billing rate and quantities.
   */
  static async recordSupplierBill(
    dto: CreateSupplierBillDto,
    userId: number
  ): Promise<{ bill: any; lines: any[] }> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'SUPPLIER_BILL_RECORD',
        reason: `Record supplier bill ${dto.supplierBillNo} for supplier ID: ${dto.supplierId}`,
      },
      async (client: PoolClient) => {
        // 1. Verify Supplier
        const suppRes = await client.query(
          `SELECT supplier_id, name, is_active FROM supplier WHERE supplier_id = $1`,
          [dto.supplierId]
        );
        if (suppRes.rowCount === 0) {
          throw new Error('SUPPLIER_NOT_FOUND');
        }
        if (!suppRes.rows[0].is_active) {
          throw new Error('SUPPLIER_INACTIVE');
        }

        // 2. Insert Bill Header
        const billRes = await client.query(
          `INSERT INTO supplier_bill (
             supplier_id, supplier_bill_no, bill_date, status
           ) VALUES (
             $1, $2, $3::date, 'recorded'
           ) RETURNING bill_id, supplier_id, supplier_bill_no, bill_date, total_amount, status, created_at`,
          [dto.supplierId, dto.supplierBillNo.trim(), dto.billDate]
        );

        const newBill = billRes.rows[0];
        const createdLines: any[] = [];

        // 3. Insert Bill Lines
        // Each insert fires:
        // - trg_bill_line_before (verifies creation within same tx and billed qty <= received qty)
        // - trg_bill_total (updates total_amount on supplier_bill)
        for (const line of dto.lines) {
          const lineRes = await client.query(
            `INSERT INTO supplier_bill_line (
               bill_id, receipt_item_id, quantity, rate, amount
             ) VALUES (
               $1, $2, $3, $4, round($3 * $4, 2)
             ) RETURNING bill_line_id, bill_id, receipt_item_id, quantity, rate, amount, created_at`,
            [
              newBill.bill_id,
              line.receiptItemId,
              line.quantity,
              line.rate,
            ]
          );
          createdLines.push(lineRes.rows[0]);
        }

        const finalBill = await client.query(
          `SELECT * FROM supplier_bill WHERE bill_id = $1`,
          [newBill.bill_id]
        );

        return {
          bill: finalBill.rows[0],
          lines: createdLines,
        };
      }
    );
  }

  /**
   * WF-8: Record Customer Payment & Invoicing Allocations
   * Strict allocation rules: total allocations cannot exceed payment or invoice balance.
   */
  static async recordBuyerPayment(
    dto: RecordBuyerPaymentDto,
    userId: number
  ): Promise<{ payment: any; allocations: any[]; isIdempotentRetry: boolean }> {
    // 1. Check idempotency
    const existingPayment = await TxManager.queryOne<any>(
      `SELECT payment_id, payment_ref, buyer_id, received_on, amount, mode, instrument_ref, status, client_request_id, created_at 
         FROM buyer_payment 
        WHERE client_request_id = $1`,
      [dto.clientRequestId]
    );

    if (existingPayment) {
      const existingAllocs = await TxManager.query<any>(
        `SELECT allocation_id, payment_id, invoice_id, allocated_amount, created_at 
           FROM payment_allocation 
          WHERE payment_id = $1`,
        [existingPayment.payment_id]
      );

      return {
        payment: existingPayment,
        allocations: existingAllocs,
        isIdempotentRetry: true,
      };
    }

    // 2. Perform Atomic Payment Recording & Allocation
    return await TxManager.withTransaction(
      {
        userId,
        source: 'BUYER_PAYMENT_RECORD',
        reason: `Record buyer payment ${dto.amount} for buyer ID: ${dto.buyerId}`,
      },
      async (client: PoolClient) => {
        // Validate Buyer
        const buyerRes = await client.query(
          `SELECT buyer_id, name, is_active FROM buyer WHERE buyer_id = $1`,
          [dto.buyerId]
        );
        if (buyerRes.rowCount === 0) {
          throw new Error('BUYER_NOT_FOUND');
        }

        // Insert buyer_payment
        const payRes = await client.query(
          `INSERT INTO buyer_payment (
             buyer_id, received_on, amount, mode, instrument_ref, client_request_id, status
           ) VALUES (
             $1, $2::date, $3, $4, $5, $6, 'recorded'
           ) RETURNING payment_id, payment_ref, buyer_id, received_on, amount, mode, instrument_ref, status, client_request_id, created_at`,
          [
            dto.buyerId,
            dto.receivedOn,
            dto.amount,
            dto.mode,
            dto.instrumentRef ? dto.instrumentRef.trim() : null,
            dto.clientRequestId,
          ]
        );

        const newPayment = payRes.rows[0];
        const createdAllocations: any[] = [];

        // Insert Allocations if specified
        if (dto.allocations && dto.allocations.length > 0) {
          for (const alloc of dto.allocations) {
            // Inserting into payment_allocation fires trg_alloc_before which:
            // - Locks payment then invoice
            // - Verifies buyer match
            // - Verifies alloc <= payment amount and alloc <= invoice total
            const allocRes = await client.query(
              `INSERT INTO payment_allocation (
                 payment_id, invoice_id, allocated_amount
               ) VALUES (
                 $1, $2, $3
               ) RETURNING allocation_id, payment_id, invoice_id, allocated_amount, created_at`,
              [newPayment.payment_id, alloc.invoiceId, alloc.amount]
            );
            createdAllocations.push(allocRes.rows[0]);
          }
        }

        return {
          payment: newPayment,
          allocations: createdAllocations,
          isIdempotentRetry: false,
        };
      }
    );
  }

  /**
   * Get Buyer Account Ledger (reads from view v_buyer_ledger)
   */
  static async getBuyerLedger(buyerId: number): Promise<any[]> {
    return await TxManager.query<any>(
      `SELECT * FROM v_buyer_ledger WHERE buyer_id = $1 ORDER BY txn_date ASC, recorded_at ASC, document_ref ASC`,
      [buyerId]
    );
  }

  /**
   * Get Supplier Bill Variances (reads from view v_supplier_bill_variance)
   */
  static async getSupplierBillVariances(): Promise<any[]> {
    return await TxManager.query<any>(
      `SELECT * FROM v_supplier_bill_variance ORDER BY bill_date DESC, bill_id DESC`
    );
  }

  /**
   * Get Single Invoice Details by ID
   */
  static async getInvoiceById(invoiceId: number): Promise<any> {
    const inv = await TxManager.queryOne<any>(
      `SELECT i.invoice_id, i.invoice_no, i.buyer_id, b.name AS buyer_name,
              b.tax_id AS buyer_tax_id, i.invoice_date, i.total_amount, i.status,
              i.issued_at, i.voided_at, i.void_reason, i.version, i.created_at,
              COALESCE(SUM(pa.allocated_amount), 0.00) AS paid_amount,
              (i.total_amount - COALESCE(SUM(pa.allocated_amount), 0.00)) AS balance_amount
         FROM invoice i
         JOIN buyer b ON i.buyer_id = b.buyer_id
    LEFT JOIN payment_allocation pa ON i.invoice_id = pa.invoice_id
        WHERE i.invoice_id = $1
        GROUP BY i.invoice_id, i.invoice_no, i.buyer_id, b.name, b.tax_id, i.invoice_date, 
                 i.total_amount, i.status, i.issued_at, i.voided_at, i.void_reason, i.version, i.created_at`,
      [invoiceId]
    );

    if (!inv) {
      throw new Error('INVOICE_NOT_FOUND');
    }

    const items = await TxManager.query<any>(
      `SELECT ii.invoice_item_id, ii.invoice_id, ii.order_item_id, ii.quantity, ii.rate, ii.amount,
              fp.name AS fabric_product_name, c.name AS colour_name, u.unit_code,
              co.order_no
         FROM invoice_item ii
         JOIN order_item oi ON ii.order_item_id = oi.order_item_id
         JOIN customer_order co ON oi.order_id = co.order_id
         JOIN fabric_product fp ON oi.product_id = fp.product_id
         JOIN colour c ON oi.colour_id = c.colour_id
         JOIN unit_of_measure u ON fp.unit_id = u.unit_id
        WHERE ii.invoice_id = $1
        ORDER BY ii.invoice_item_id ASC`,
      [invoiceId]
    );

    return {
      ...inv,
      items,
    };
  }

  /**
   * List Accounting Periods (sorted by period_start DESC)
   */
  static async listAccountingPeriods(): Promise<any[]> {
    return await TxManager.query<any>(
      `SELECT period_id, period_start, period_end, status, closed_at, closed_by, created_at, updated_at
         FROM accounting_period
        ORDER BY period_start DESC;`
    );
  }

  /**
   * WF-14: Close Accounting Period
   * Permanently closes the accounting period, locking all financial transactions,
   * wage records, costs, and invoices for that month (BR004).
   * Verified by trigger trg_period_before that 0 draft wage records remain.
   */
  static async closeAccountingPeriod(
    periodId: number,
    userId: number
  ): Promise<any> {
    return await TxManager.withTransaction(
      {
        userId,
        source: 'FinanceService.closeAccountingPeriod',
        reason: `Close accounting period #${periodId}`,
      },
      async (client: PoolClient) => {
        // 1. Verify period existence & current status
        const periodRes = await client.query(
          `SELECT period_id, period_start, period_end, status 
             FROM accounting_period 
            WHERE period_id = $1 
              FOR UPDATE;`,
          [periodId]
        );

        if (periodRes.rowCount === 0) {
          throw new Error('PERIOD_NOT_FOUND');
        }

        const period = periodRes.rows[0];
        if (period.status === 'closed') {
          throw new Error('PERIOD_ALREADY_CLOSED: Accounting period is already closed.');
        }

        // 2. Pre-check: Ensure zero draft wage records remain in the period
        const draftWagesRes = await client.query(
          `SELECT COUNT(*) AS draft_count 
             FROM wage_record 
            WHERE period_id = $1 AND status = 'draft';`,
          [periodId]
        );

        const draftCount = parseInt(draftWagesRes.rows[0]?.draft_count || '0', 10);
        if (draftCount > 0) {
          throw new Error(`DRAFT_WAGES_REMAIN: Cannot close period with ${draftCount} draft wage records. Approve or reverse them first.`);
        }

        // 3. Update period status to closed (trigger trg_period_before sets closed_at & closed_by)
        const updateRes = await client.query(
          `UPDATE accounting_period
              SET status = 'closed',
                  closed_at = now(),
                  closed_by = $2,
                  updated_by = $2,
                  updated_at = now()
            WHERE period_id = $1
            RETURNING *;`,
          [periodId, userId]
        );

        return updateRes.rows[0];
      }
    );
  }
}

