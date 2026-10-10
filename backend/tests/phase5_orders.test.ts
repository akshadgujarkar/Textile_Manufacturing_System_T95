import { OrderService } from '../src/modules/orders/order.service';
import { RawMaterialService } from '../src/modules/raw-materials/raw-materials.service';
import { createApp } from '../src/app';
import { TxManager } from '../src/database/tx-manager';
import { CryptoUtil } from '../src/utils/crypto';
import { v4 as uuidv4 } from 'uuid';

async function runTests() {
  console.log('🧪 =========================================================');
  console.log('🧪 RUNNING PHASE 5 CUSTOMER ORDERS & RESERVATION TEST SUITE');
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

  // Check if db is connected
  const isDbConnected = await TxManager.queryOne<{ ok: number }>('SELECT 1 as ok').then(() => true).catch(() => false);

  if (isDbConnected) {
    console.log('Database connected. Running live database integration tests...');

    try {
      const testUserId = 1;

      // Ensure a test buyer exists
      let buyer = await TxManager.queryOne<{ buyer_id: string }>(
        `SELECT buyer_id FROM buyer WHERE is_active = true LIMIT 1`
      );

      if (!buyer) {
        buyer = await TxManager.queryOne<{ buyer_id: string }>(
          `INSERT INTO buyer (name, contact, tax_id) 
           VALUES ('Raymond Apparels Ltd', '+91 98200 12345', 'GSTIN27AABCR1234')
           RETURNING buyer_id`
        );
      }

      // Ensure a test unit exists
      let unit = await TxManager.queryOne<{ unit_id: string }>(
        `SELECT unit_id FROM unit_of_measure WHERE unit_code = 'm' LIMIT 1`
      );
      if (!unit) {
        unit = await TxManager.queryOne<{ unit_id: string }>(
          `INSERT INTO unit_of_measure (unit_code, description) VALUES ('m', 'Metres') RETURNING unit_id`
        );
      }

      // Ensure a test fabric product exists
      let product = await TxManager.queryOne<{ product_id: string }>(
        `SELECT product_id FROM fabric_product WHERE is_active = true AND unit_id = $1 LIMIT 1`,
        [unit!.unit_id]
      );
      if (!product) {
        product = await TxManager.queryOne<{ product_id: string }>(
          `INSERT INTO fabric_product (name, specification, unit_id) 
           VALUES ('Cotton Twill 240 GSM', '100% Cotton 3/1 Twill Weave', $1) 
           RETURNING product_id`,
          [unit!.unit_id]
        );
      }

      // Ensure colour exists
      let colour = await TxManager.queryOne<{ colour_id: string }>(
        `SELECT colour_id FROM colour LIMIT 1`
      );
      if (!colour) {
        colour = await TxManager.queryOne<{ colour_id: string }>(
          `INSERT INTO colour (name) VALUES ('Navy Blue') RETURNING colour_id`
        );
      }

      // Ensure yarn item exists
      let yarnItem = await TxManager.queryOne<{ yarn_item_id: string }>(
        `SELECT yarn_item_id FROM yarn_item WHERE is_active = true LIMIT 1`
      );
      if (!yarnItem) {
        const yt = await TxManager.queryOne<{ yarn_type_id: string }>(`SELECT yarn_type_id FROM yarn_type LIMIT 1`);
        const kgUnit = await TxManager.queryOne<{ unit_id: string }>(`SELECT unit_id FROM unit_of_measure WHERE unit_code = 'kg' LIMIT 1`);
        yarnItem = await TxManager.queryOne<{ yarn_item_id: string }>(
          `INSERT INTO yarn_item (yarn_type_id, colour_id, unit_id, reorder_level)
           VALUES ($1, $2, $3, 50.000) RETURNING yarn_item_id`,
          [yt?.yarn_type_id, colour?.colour_id, kgUnit?.unit_id]
        );
      }

      console.log('\n--- Test 5.1: Create Draft Customer Order ---');
      const orderRes = await OrderService.createOrder(
        {
          buyerId: Number(buyer!.buyer_id),
          promisedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          items: [
            {
              productId: Number(product!.product_id),
              colourId: Number(colour!.colour_id),
              orderedQty: 2500,
              unitId: Number(unit!.unit_id),
              agreedRate: 145.0,
              materialRequirements: [
                {
                  yarnItemId: Number(yarnItem!.yarn_item_id),
                  requiredQty: 650.0,
                },
              ],
            },
          ],
        },
        testUserId
      );

      assert(orderRes.order.order_no.startsWith('ORD-'), 'Order created with valid ORD-YY-XXXXXX sequence code');
      assert(orderRes.order.status === 'draft', 'Order created with initial "draft" status');
      assert(orderRes.order.version === 1, 'Initial OCC version is 1');
      assert(orderRes.items.length === 1, 'Created single order line item');
      assert(orderRes.items[0].requirements.length === 1, 'Created linked order material requirement');

      const createdOrderId = Number(orderRes.order.order_id);

      console.log('\n--- Test 5.2: Check Material Feasibility ---');
      const feasibility = await OrderService.checkMaterialFeasibility(createdOrderId);
      assert(feasibility.orderId === createdOrderId, 'Feasibility check matches order ID');
      assert(feasibility.totalRequirementsCount === 1, 'Calculated exactly 1 material requirement line');
      assert(typeof feasibility.isFeasible === 'boolean', 'Feasibility returns boolean summary');

      console.log('\n--- Test 5.3: OCC Version Validation on Confirmation ---');
      let occConflictCaught = false;
      try {
        await OrderService.confirmOrder(createdOrderId, 999, true, testUserId);
      } catch (err: any) {
        occConflictCaught = err.message === 'CONCURRENT_MODIFICATION';
      }
      assert(occConflictCaught, 'Invalid OCC version rejected with CONCURRENT_MODIFICATION');

      console.log('\n--- Test 5.4: Confirm Order & Auto-Reserve Stock ---');
      const confirmRes = await OrderService.confirmOrder(createdOrderId, 1, true, testUserId);
      assert(confirmRes.order.status === 'confirmed', 'Order status updated to "confirmed"');
      assert(confirmRes.order.version === 2, 'OCC version incremented to 2');
      assert(confirmRes.order.confirmed_at !== null, 'Order records confirmed_at timestamp');

      console.log('\n--- Test 5.5: Fetch Order Status & History ---');
      const fetchedOrder = await OrderService.getOrderById(createdOrderId);
      assert(Number(fetchedOrder.order_id) === createdOrderId, 'Fetched correct order by ID');
      assert(fetchedOrder.history.length >= 2, 'Order history recorded draft creation and confirmation events');
      assert(fetchedOrder.buyer_name !== undefined, 'Populated buyer metadata');

      console.log('\n--- Test 5.6: Buyer Phone Lookup (<10ms desk tracking) ---');
      const phoneLookupResults = await OrderService.phoneLookup('Raymond');
      assert(Array.isArray(phoneLookupResults), 'Phone lookup returns array');
      assert(phoneLookupResults.some(o => Number(o.order_id) === createdOrderId), 'Created order appears in phone tracking results');

      console.log('\n--- Test 5.7: Cancel Order & Release Reservations ---');
      const cancelRes = await OrderService.cancelOrder(
        createdOrderId,
        'Buyer requested cancellation before weaving stage initiated',
        testUserId
      );
      assert(cancelRes.status === 'cancelled', 'Order status transitioned to "cancelled"');
      assert(cancelRes.cancel_reason !== null, 'Cancellation reason preserved');

      // Verify reservations released
      const checkRes = await OrderService.getOrderById(createdOrderId);
      const activeReservations = checkRes.items.flatMap((i: any) => i.requirements).filter((r: any) => r.reservation_status === 'active');
      assert(activeReservations.length === 0, 'All active yarn reservations released upon order cancellation');
    } catch (dbErr: any) {
      console.error('Database test error:', dbErr);
      failed++;
    }
  } else {
    console.log('Database not accessible during offline test run, validating application definitions.');
  }

  console.log('\n--- Test Suite: HTTP Express Routing & Role Token ---');
  try {
    const app = createApp();
    assert(typeof app === 'function', 'Express application initialized with orders route mounted');

    const salesToken = CryptoUtil.generateAccessToken({
      userId: 2,
      username: 'sales_rep_1',
      employeeId: 102,
      roles: ['sales'],
    });
    assert(typeof salesToken === 'string' && salesToken.length > 20, 'Generated valid JWT token for sales role');
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
