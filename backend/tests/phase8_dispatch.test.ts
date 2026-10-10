import { DispatchService } from '../src/modules/dispatch/dispatch.service';
import { QualityService } from '../src/modules/quality/quality.service';
import { createApp } from '../src/app';
import { TxManager } from '../src/database/tx-manager';
import { CryptoUtil } from '../src/utils/crypto';
import { v4 as uuidv4 } from 'uuid';

async function runTests() {
  console.log('🧪 =========================================================');
  console.log('🧪 RUNNING PHASE 8 DISPATCH & LOADING SCANNING TEST SUITE');
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
    console.log('Database connected. Running live dispatch integration tests...');

    try {
      const testUserId = 1;

      // 1. Ensure an active buyer & confirmed order with ready rolls exists
      let order = await TxManager.queryOne<{ order_id: string; buyer_id: string }>(
        `SELECT order_id, buyer_id FROM customer_order WHERE status IN ('confirmed', 'closed') LIMIT 1`
      );

      let inStockRoll = await TxManager.queryOne<{ roll_id: string; roll_code: string }>(
        `SELECT fr.roll_id, fr.roll_code 
           FROM fabric_roll fr
           JOIN production_job pj ON fr.job_id = pj.job_id
           JOIN order_item oi ON pj.order_item_id = oi.order_item_id
          WHERE fr.status = 'in_stock' AND oi.order_id = $1 LIMIT 1`,
        [order?.order_id]
      );

      if (order && inStockRoll) {
        console.log('\n--- Test 8.1: Create Draft Dispatch Manifest ---');
        const dispatch = await DispatchService.createDispatch(
          {
            buyerId: Number(order.buyer_id),
            orderId: Number(order.order_id),
            vehicleNo: 'MH-12-AB-1234',
          },
          testUserId
        );

        assert(dispatch.dispatch_no.startsWith('DSP-'), 'Generated valid DSP-YY-XXXXXX sequence code');
        assert(dispatch.status === 'draft', 'Dispatch created in "draft" status');
        assert(dispatch.version === 1, 'Initial OCC version is 1');

        const createdDispatchId = Number(dispatch.dispatch_id);

        console.log('\n--- Test 8.2: Start Loading Manifest ---');
        const loadingDsp = await DispatchService.startLoading(createdDispatchId, 1, testUserId);
        assert(loadingDsp.status === 'loading', 'Dispatch transitioned to "loading" status');
        assert(loadingDsp.version === 2, 'Version incremented to 2');

        console.log('\n--- Test 8.3: Live Barcode Roll Scan (WF-9) ---');
        const scanRes = await DispatchService.scanRollToDispatch(
          createdDispatchId,
          inStockRoll.roll_code,
          testUserId
        );

        assert(scanRes.dispatchItem.state === 'active', 'Dispatch item inserted with active state');
        assert(scanRes.roll.status === 'loaded', 'Fabric roll status transitioned to "loaded"');

        console.log('\n--- Test 8.4: Double-Dispatch Prevention Guard ---');
        let doubleDispatchBlocked = false;
        try {
          // Attempt to scan the same active roll onto another truck
          const secondDsp = await DispatchService.createDispatch(
            {
              buyerId: Number(order.buyer_id),
              orderId: Number(order.order_id),
              vehicleNo: 'MH-14-XY-9999',
            },
            testUserId
          );
          await DispatchService.scanRollToDispatch(
            Number(secondDsp.dispatch_id),
            inStockRoll.roll_code,
            testUserId
          );
        } catch (err: any) {
          doubleDispatchBlocked = err.message.includes('ROLL_NOT_IN_STOCK') || err.message.includes('uq_dispatch_item_one_active_roll') || err.code === '23505';
        }
        assert(doubleDispatchBlocked, 'Double-dispatching a roll already loaded on a truck was blocked');

        console.log('\n--- Test 8.5: Remove Item from Dispatch ---');
        const removedItem = await DispatchService.removeRollFromDispatch(
          Number(scanRes.dispatchItem.dispatch_item_id),
          'Test roll removal - repacking required',
          testUserId
        );
        assert(removedItem.state === 'removed', 'Dispatch item marked as removed');

        // Re-scan roll back to truck for completion test
        await DispatchService.scanRollToDispatch(createdDispatchId, inStockRoll.roll_code, testUserId);

        console.log('\n--- Test 8.6: Complete Dispatch & Truck Departure (WF-10) ---');
        const completeRes = await DispatchService.completeDispatch(
          createdDispatchId,
          'MH-12-AB-1234',
          testUserId
        );
        assert(completeRes.status === 'dispatched', 'Dispatch manifest status updated to "dispatched"');
        assert(completeRes.dispatched_at !== null, 'Recorded dispatched_at timestamp');
        assert(completeRes.dispatchedRollsCount >= 1, 'Verified non-empty active roll count');

        console.log('\n--- Test 8.7: Query Progress & Commercial Billing Lines ---');
        const progress = await DispatchService.getDispatchProgress(Number(order.order_id));
        assert(Array.isArray(progress), 'getDispatchProgress returned order progress array');

        const lines = await DispatchService.getDispatchLines(createdDispatchId);
        assert(Array.isArray(lines), 'getDispatchLines returned commercial billing lines');
      }
    } catch (dbErr: any) {
      console.error('Database test error:', dbErr);
      failed++;
    }
  } else {
    console.log('Database not accessible during offline test run, validating application definitions.');
  }

  console.log('\n--- Test Suite: HTTP Express Routing & Dispatcher Token ---');
  try {
    const app = createApp();
    assert(typeof app === 'function', 'Express application initialized with dispatch routes');

    const dispatchToken = CryptoUtil.generateAccessToken({
      userId: 5,
      username: 'dispatch_officer_1',
      employeeId: 105,
      roles: ['dispatch'],
    });
    assert(typeof dispatchToken === 'string' && dispatchToken.length > 20, 'Generated valid JWT token for dispatch role');
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
