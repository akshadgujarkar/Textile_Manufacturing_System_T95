import { RawMaterialService } from '../src/modules/raw-materials/raw-materials.service';
import { createApp } from '../src/app';
import { TxManager } from '../src/database/tx-manager';
import { v4 as uuidv4 } from 'uuid';
import { CryptoUtil } from '../src/utils/crypto';

async function runTests() {
  console.log('🧪 =========================================================');
  console.log('🧪 RUNNING PHASE 4 RAW MATERIALS & GATE INWARD TEST SUITE');
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

  // Test 1: ZPL Barcode Generation logic
  try {
    console.log('--- Test Suite 1: ZPL Barcode & Thermal Label Formatting ---');
    // We can test the ZPL formatting logic by creating a mock lot or calling if database is connected
    const mockLotCode = 'LOT-26-000001';
    
    // Check if db is connected
    const isDbConnected = await TxManager.queryOne<{ ok: number }>('SELECT 1 as ok').then(() => true).catch(() => false);
    
    if (isDbConnected) {
      console.log('Database connected. Running live database integration tests...');

      // Get or create an active supplier
      let supplier = await TxManager.queryOne<{ supplier_id: string }>(
        `SELECT supplier_id FROM supplier WHERE is_active = true LIMIT 1`
      );

      if (!supplier) {
        supplier = await TxManager.queryOne<{ supplier_id: string }>(
          `INSERT INTO supplier (name, supplier_code, contact_person, phone) 
           VALUES ('Vardhman Polytex', 'SUP-VARDHMAN', 'Amit Sharma', '+91 98765 43210')
           RETURNING supplier_id`
        );
      }

      // Get or create a yarn item
      let yarnItem = await TxManager.queryOne<{ yarn_item_id: string }>(
        `SELECT yarn_item_id FROM yarn_item WHERE is_active = true LIMIT 1`
      );

      if (!yarnItem) {
        const yarnType = await TxManager.queryOne<{ yarn_type_id: string }>(
          `SELECT yarn_type_id FROM yarn_type LIMIT 1`
        );
        const colour = await TxManager.queryOne<{ colour_id: string }>(
          `SELECT colour_id FROM colour LIMIT 1`
        );
        const unit = await TxManager.queryOne<{ unit_id: string }>(
          `SELECT unit_id FROM unit_of_measure WHERE unit_code = 'kg' LIMIT 1`
        );

        yarnItem = await TxManager.queryOne<{ yarn_item_id: string }>(
          `INSERT INTO yarn_item (yarn_type_id, colour_id, unit_id, reorder_level)
           VALUES ($1, $2, $3, 100.000)
           RETURNING yarn_item_id`,
          [yarnType?.yarn_type_id, colour?.colour_id, unit?.unit_id]
        );
      }

      const clientRequestId = uuidv4();
      const testUserId = 1; // system / admin user

      // Test 1.1: Create Gate Inward Entry (WF-1)
      const receiptRes = await RawMaterialService.createGateReceipt(
        {
          supplierId: Number(supplier!.supplier_id),
          supplierChallanNo: 'CHAL-TEST-9901',
          clientRequestId,
          items: [
            {
              yarnItemId: Number(yarnItem!.yarn_item_id),
              quantityReceived: 450.5,
              challanQuantity: 450.5,
              unitRate: 265.0,
            },
          ],
        },
        testUserId
      );

      assert(receiptRes.receipt.receipt_no.startsWith('GRN-'), 'Gate entry generated valid GRN code format');
      assert(receiptRes.items.length === 1, 'Gate entry created exact number of lot items');
      assert(receiptRes.items[0].lot_code.startsWith('LOT-'), 'Yarn lot item generated valid LOT code format');
      assert(receiptRes.isIdempotentRetry === false, 'First creation marked isIdempotentRetry as false');

      const createdLotCode = receiptRes.items[0].lot_code;
      const createdReceiptId = Number(receiptRes.receipt.receipt_id);

      // Test 1.2: Idempotency Protection - Resubmitting with identical client_request_id
      const retryRes = await RawMaterialService.createGateReceipt(
        {
          supplierId: Number(supplier!.supplier_id),
          supplierChallanNo: 'CHAL-TEST-9901',
          clientRequestId,
          items: [
            {
              yarnItemId: Number(yarnItem!.yarn_item_id),
              quantityReceived: 450.5,
            },
          ],
        },
        testUserId
      );

      assert(retryRes.isIdempotentRetry === true, 'Duplicate clientRequestId recognized as idempotent retry');
      assert(Number(retryRes.receipt.receipt_id) === createdReceiptId, 'Idempotent retry returned identical receipt_id');

      // Test 1.3: Fetch Receipt by ID
      const fetchedReceipt = await RawMaterialService.getReceiptById(createdReceiptId);
      assert(Number(fetchedReceipt.receipt_id) === createdReceiptId, 'getReceiptById fetched correct receipt');
      assert(fetchedReceipt.items.length === 1, 'getReceiptById included nested lot items');
      assert(fetchedReceipt.supplier_name !== undefined, 'getReceiptById populated supplier metadata');

      // Test 1.4: Thermal Barcode & ZPL Generation
      const barcodePayload = await RawMaterialService.getLotBarcodePayload(createdLotCode);
      assert(barcodePayload.lotCode === createdLotCode, 'Barcode payload matches lot code');
      assert(barcodePayload.zplCode.includes('^XA') && barcodePayload.zplCode.includes('^XZ'), 'Generated valid ZPL II envelope');
      assert(barcodePayload.zplCode.includes(createdLotCode), 'ZPL contains lot code');
      assert(barcodePayload.qrData.includes(createdLotCode), 'QR payload contains JSON formatted lot tracking details');

      // Test 1.5: View queries - v_yarn_stock, v_unbilled_lots
      const stockRes = await RawMaterialService.getYarnStock({ limit: 10 });
      assert(Array.isArray(stockRes.data), 'getYarnStock returned array from v_yarn_stock view');

      const unbilledLots = await RawMaterialService.getUnbilledLots(Number(supplier!.supplier_id));
      assert(Array.isArray(unbilledLots), 'getUnbilledLots returned list from v_unbilled_lots view');
      assert(unbilledLots.some(l => l.lot_code === createdLotCode), 'Created lot appears in v_unbilled_lots');

      // Test 1.6: Cancel Gate Receipt (WF-2)
      const cancelRes = await RawMaterialService.cancelGateReceipt(
        createdReceiptId,
        'Quality inspection rejection at mill gate test',
        testUserId
      );
      assert(cancelRes.status === 'cancelled', 'cancelGateReceipt updated status to cancelled');
      assert(cancelRes.cancelled_at !== null, 'cancelGateReceipt recorded cancelled_at timestamp');

      // Test 1.7: Double cancellation prevention
      let doubleCancelFailed = false;
      try {
        await RawMaterialService.cancelGateReceipt(createdReceiptId, 'Duplicate cancel attempt', testUserId);
      } catch (err: any) {
        doubleCancelFailed = err.message === 'RECEIPT_ALREADY_CANCELLED';
      }
      assert(doubleCancelFailed, 'Double cancellation properly rejected');
    } else {
      console.log('Database not accessible during offline testing, skipping DB queries.');
    }
  } catch (error: any) {
    console.error('Test execution error:', error);
    failed++;
  }

  // Test Suite 2: Express App Initialization & Route Verification
  console.log('\n--- Test Suite 2: Express HTTP Application & Endpoints ---');
  try {
    const app = createApp();
    assert(typeof app === 'function', 'Express application initialized successfully');

    // Test JWT Generation for Gate Store role
    const token = CryptoUtil.generateAccessToken({
      userId: 1,
      username: 'gate_operator_1',
      employeeId: 101,
      roles: ['gate_store'],
    });
    assert(typeof token === 'string' && token.length > 20, 'Generated valid JWT token for gate_store role');
  } catch (error: any) {
    console.error('Express test error:', error);
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
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
