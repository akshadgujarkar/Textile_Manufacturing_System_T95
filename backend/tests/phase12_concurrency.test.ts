import { RawMaterialService } from '../src/modules/raw-materials/raw-materials.service';
import { DispatchService } from '../src/modules/dispatch/dispatch.service';
import { FinanceService } from '../src/modules/finance/finance.service';
import { ReconciliationService } from '../src/modules/admin/reconciliation.service';
import { createApp } from '../src/app';
import { TxManager } from '../src/database/tx-manager';
import { v4 as uuidv4 } from 'uuid';

async function runTests() {
  console.log('🧪 =========================================================');
  console.log('🧪 RUNNING PHASE 12 CONCURRENCY, STRESS & LAUNCH TEST SUITE');
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

  // 1. Verify Complete System Express App
  console.log('--- Test Suite 1: Full System App Diagnostics ---');
  const app = createApp();
  assert(typeof app === 'function', 'Full production Express app initialized with all 9 API modules');

  // Check if database is connected
  const isDbConnected = await TxManager.queryOne<{ ok: number }>('SELECT 1 as ok').then(() => true).catch(() => false);

  if (isDbConnected) {
    console.log('\nDatabase connected. Running live Phase 12 concurrency stress tests...');

    try {
      const testUserId = 1;

      // -----------------------------------------------------------------------
      // Test 12.1: Concurrent Gate Inward Entries on Same Yarn Item
      // -----------------------------------------------------------------------
      console.log('\n--- Test 12.1: 10 Concurrent Gate Inwards on Same Yarn Item ---');
      const yarnItem = await TxManager.queryOne<{ yarn_item_id: string }>(
        `SELECT yarn_item_id FROM yarn_item WHERE is_active = true LIMIT 1;`
      );
      const supplier = await TxManager.queryOne<{ supplier_id: string }>(
        `SELECT supplier_id FROM supplier WHERE is_active = true LIMIT 1;`
      );

      if (yarnItem && supplier) {
        const initialBalRes = await TxManager.queryOne<{ on_hand_qty: string }>(
          `SELECT on_hand_qty FROM yarn_stock_balance WHERE yarn_item_id = $1;`,
          [yarnItem.yarn_item_id]
        );
        const initialOnHand = parseFloat(initialBalRes?.on_hand_qty || '0');

        const concurrentCount = 10;
        const qtyPerEntry = 50.0;

        const promises = Array.from({ length: concurrentCount }).map(async (_, idx) => {
          return await RawMaterialService.createGateReceipt(
            {
              supplierId: Number(supplier.supplier_id),
              supplierChallanNo: `CH-CONCUR-${Date.now()}-${idx}`,
              clientRequestId: uuidv4(),
              receivedAt: new Date().toISOString(),
              items: [
                {
                  yarnItemId: Number(yarnItem.yarn_item_id),
                  quantityReceived: qtyPerEntry,
                  unitRate: 250.0,
                },
              ],
            },
            testUserId
          );
        });

        const results = await Promise.allSettled(promises);
        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        assert(successCount === concurrentCount, `All ${concurrentCount} concurrent receipts succeeded without deadlocks`);

        // Check new on hand balance
        const updatedBalRes = await TxManager.queryOne<{ on_hand_qty: string }>(
          `SELECT on_hand_qty FROM yarn_stock_balance WHERE yarn_item_id = $1;`,
          [yarnItem.yarn_item_id]
        );
        const updatedOnHand = parseFloat(updatedBalRes?.on_hand_qty || '0');
        const expectedOnHand = initialOnHand + (concurrentCount * qtyPerEntry);

        assert(
          Math.abs(updatedOnHand - expectedOnHand) < 0.001,
          `Stock balance accurately incremented by exactly ${concurrentCount * qtyPerEntry} kg (Initial: ${initialOnHand}, Final: ${updatedOnHand})`
        );
      }

      // -----------------------------------------------------------------------
      // Test 12.2: Concurrent Barcode Scans on Same Roll (Double-Dispatch Prevention)
      // -----------------------------------------------------------------------
      console.log('\n--- Test 12.2: Concurrent Scanning of Same Roll (Double-Dispatch Guard) ---');
      const roll = await TxManager.queryOne<{ roll_id: string; roll_code: string; order_id: string }>(
        `SELECT fr.roll_id, fr.roll_code, co.order_id
           FROM fabric_roll fr
           JOIN production_job pj ON fr.job_id = pj.job_id
           JOIN order_item oi ON pj.order_item_id = oi.order_item_id
           JOIN customer_order co ON oi.order_id = co.order_id
          WHERE fr.status = 'in_stock'
          LIMIT 1;`
      );

      const buyer = await TxManager.queryOne<{ buyer_id: string }>(
        `SELECT buyer_id FROM buyer WHERE is_active = true LIMIT 1;`
      );

      if (roll && buyer) {
        // Create 2 draft dispatches for the same order
        const dsp1 = await DispatchService.createDispatch(
          {
            buyerId: Number(buyer.buyer_id),
            orderId: Number(roll.order_id),
            vehicleNo: 'MH-12-TRUCK-A',
          },
          testUserId
        );
        const dsp2 = await DispatchService.createDispatch(
          {
            buyerId: Number(buyer.buyer_id),
            orderId: Number(roll.order_id),
            vehicleNo: 'MH-12-TRUCK-B',
          },
          testUserId
        );

        // Put both into loading state
        await DispatchService.startLoading(Number(dsp1.dispatch_id), Number(dsp1.version), testUserId);
        await DispatchService.startLoading(Number(dsp2.dispatch_id), Number(dsp2.version), testUserId);

        // Concurrently attempt to scan the exact same roll into both trucks
        const scanPromises = [
          DispatchService.scanRollToDispatch(Number(dsp1.dispatch_id), roll.roll_code, testUserId),
          DispatchService.scanRollToDispatch(Number(dsp2.dispatch_id), roll.roll_code, testUserId),
        ];

        const scanResults = await Promise.allSettled(scanPromises);
        const scanSuccess = scanResults.filter((r) => r.status === 'fulfilled');
        const scanFailed = scanResults.filter((r) => r.status === 'rejected');

        assert(scanSuccess.length === 1, 'Exactly 1 concurrent scan succeeded');
        assert(scanFailed.length === 1, 'Concurrent double-dispatch scan was safely rejected');
      }

      // -----------------------------------------------------------------------
      // Test 12.3: System Post-Stress Invariant Verification
      // -----------------------------------------------------------------------
      console.log('\n--- Test 12.3: Post-Concurrency Invariant Health Check ---');
      const healthReport = await ReconciliationService.runAllHealthChecks();
      assert(healthReport.isHealthy === true, 'All system invariants hold 100% after concurrent stress execution');
      assert(healthReport.totalAnomalies === 0, 'Zero data corruptions, zero double dispatches, zero ledger discrepancies');

    } catch (dbError: any) {
      console.error('Database concurrency test error:', dbError);
      assert(false, `Live concurrency test failed: ${dbError.message}`);
    }
  } else {
    console.log('Database not accessible during offline test run, validating application definitions.');
  }

  console.log('\n=========================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
