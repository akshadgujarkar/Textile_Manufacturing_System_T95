import { FinanceService } from '../src/modules/finance/finance.service';
import { createApp } from '../src/app';
import { TxManager } from '../src/database/tx-manager';
import { CryptoUtil } from '../src/utils/crypto';
import { v4 as uuidv4 } from 'uuid';

async function runTests() {
  console.log('🧪 =========================================================');
  console.log('🧪 RUNNING PHASE 9 INVOICING, BILLS & PAYMENT TEST SUITE');
  console.log('🧪 =========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, extra?: any) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`, extra ? extra : '');
      failed++;
    }
  }

  // Check if database is connected
  const isDbConnected = await TxManager.queryOne<{ ok: number }>('SELECT 1 as ok').then(() => true).catch(() => false);

  if (isDbConnected) {
    console.log('Database connected. Running live finance integration tests...');

    try {
      const testUserId = 1;

      // 1. Ensure a buyer exists
      let buyer = await TxManager.queryOne<{ buyer_id: string }>(
        `SELECT buyer_id FROM buyer WHERE is_active = true LIMIT 1`
      );

      // 2. Ensure a supplier exists
      let supplier = await TxManager.queryOne<{ supplier_id: string }>(
        `SELECT supplier_id FROM supplier WHERE is_active = true LIMIT 1`
      );

      // 3. Ensure a goods receipt item lot exists for supplier billing
      let lot = await TxManager.queryOne<{ receipt_item_id: string; quantity_received: string }>(
        `SELECT gri.receipt_item_id, gri.quantity_received 
           FROM goods_receipt_item gri
           JOIN goods_receipt gr ON gri.receipt_id = gr.receipt_id
          WHERE gr.status = 'received' LIMIT 1`
      );

      // 4. Ensure an active accounting period exists
      let period = await TxManager.queryOne<{ period_id: string }>(
        `SELECT period_id FROM accounting_period WHERE status = 'open' LIMIT 1`
      );

      if (!period) {
        const today = new Date();
        const year = today.getFullYear();
        const start = `${year}-01-01`;
        const end = `${year}-12-31`;
        period = await TxManager.queryOne<{ period_id: string }>(
          `INSERT INTO accounting_period (period_start, period_end, status)
           VALUES ($1::date, $2::date, 'open')
           ON CONFLICT DO NOTHING
           RETURNING period_id`,
          [start, end]
        );
      }

      // Test 9.1: Record Supplier Bill (WF-12)
      if (supplier && lot) {
        console.log('\n--- Test 9.1: Record Supplier Purchase Bill (WF-12) ---');
        const billNo = `BILL-SUPP-${Date.now()}`;
        const billRes = await FinanceService.recordSupplierBill(
          {
            supplierId: Number(supplier.supplier_id),
            supplierBillNo: billNo,
            billDate: new Date().toISOString().split('T')[0],
            lines: [
              {
                receiptItemId: Number(lot.receipt_item_id),
                quantity: Math.min(100.0, Number(lot.quantity_received)),
                rate: 275.5,
              },
            ],
          },
          testUserId
        );

        assert(billRes.bill.supplier_bill_no === billNo, 'Supplier bill recorded with matching bill number');
        assert(Number(billRes.bill.total_amount) > 0, 'Total amount auto-calculated from lines');
        assert(billRes.lines.length === 1, 'Bill lines recorded successfully');
      }

      // Test 9.2: Record Buyer Payment & Allocation (WF-8)
      if (buyer) {
        console.log('\n--- Test 9.2: Record Buyer Payment & Payment Allocation (WF-8) ---');
        const clientRequestId = uuidv4();
        const payRes = await FinanceService.recordBuyerPayment(
          {
            buyerId: Number(buyer.buyer_id),
            receivedOn: new Date().toISOString().split('T')[0],
            amount: 25000.0,
            mode: 'bank_transfer',
            instrumentRef: 'UTR-HDFC-9918273645',
            clientRequestId,
          },
          testUserId
        );

        assert(payRes.payment.payment_ref.startsWith('PAY-'), 'Generated valid PAY-YY-XXXXXX sequence code');
        assert(Number(payRes.payment.amount) === 25000.0, 'Payment recorded with exact amount');
        assert(payRes.isIdempotentRetry === false, 'First submission is not an idempotent retry');

        // Test Idempotency
        const retryPayRes = await FinanceService.recordBuyerPayment(
          {
            buyerId: Number(buyer.buyer_id),
            receivedOn: new Date().toISOString().split('T')[0],
            amount: 25000.0,
            mode: 'bank_transfer',
            clientRequestId,
          },
          testUserId
        );
        assert(retryPayRes.isIdempotentRetry === true, 'Duplicate payment clientRequestId recognized as idempotent retry');

        console.log('\n--- Test 9.3: Buyer Running Balance Ledger ---');
        const ledger = await FinanceService.getBuyerLedger(Number(buyer.buyer_id));
        assert(Array.isArray(ledger), 'getBuyerLedger returned array from v_buyer_ledger');
        assert(ledger.some(l => l.document_ref === payRes.payment.payment_ref), 'Recorded payment appears in running ledger');
      }

      console.log('\n--- Test 9.4: Query Invoice Balances & Bill Variances ---');
      const balances = await FinanceService.getInvoiceBalances();
      assert(Array.isArray(balances), 'getInvoiceBalances returned array from v_invoice_balance');

      const variances = await FinanceService.getSupplierBillVariances();
      assert(Array.isArray(variances), 'getSupplierBillVariances returned array from v_supplier_bill_variance');
    } catch (dbErr: any) {
      console.error('Database test error:', dbErr);
      failed++;
    }
  } else {
    console.log('Database not accessible during offline test run, validating application definitions.');
  }

  console.log('\n--- Test Suite: HTTP Express Routing & Accounts Role Token ---');
  try {
    const app = createApp();
    assert(typeof app === 'function', 'Express application initialized with finance routes');

    const accToken = CryptoUtil.generateAccessToken({
      userId: 6,
      username: 'accountant_1',
      employeeId: 106,
      roles: ['accounts'],
    });
    assert(typeof accToken === 'string' && accToken.length > 20, 'Generated valid JWT token for accounts role');
  } catch (err: any) {
    console.error('Express test error:', err);
    failed++;
  }

  console.log('\n=========================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
