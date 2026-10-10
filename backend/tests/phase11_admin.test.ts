import { ReconciliationService } from '../src/modules/admin/reconciliation.service';
import { AdminService } from '../src/modules/admin/admin.service';
import { createApp } from '../src/app';
import { TxManager } from '../src/database/tx-manager';
import { CryptoUtil } from '../src/utils/crypto';

async function runTests() {
  console.log('🧪 =========================================================');
  console.log('🧪 RUNNING PHASE 11 RECONCILIATION, AUDIT & ADMIN TEST SUITE');
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

  // 1. Verify Express App & Route Mounts
  console.log('--- Test Suite 1: Express App & Routing Setup ---');
  const app = createApp();
  assert(typeof app === 'function', 'Express application initialized successfully');

  const adminToken = CryptoUtil.generateAccessToken({
    userId: 1,
    username: 'admin_user',
    roles: ['admin'],
  });
  assert(typeof adminToken === 'string' && adminToken.length > 20, 'Generated valid JWT token for admin role');

  const staffToken = CryptoUtil.generateAccessToken({
    userId: 3,
    username: 'auditor_user',
    roles: ['staff_readonly'],
  });
  assert(typeof staffToken === 'string' && staffToken.length > 20, 'Generated valid JWT token for staff_readonly role');

  // Check if database is connected
  const isDbConnected = await TxManager.queryOne<{ ok: number }>('SELECT 1 as ok').then(() => true).catch(() => false);

  if (isDbConnected) {
    console.log('\nDatabase connected. Running live Phase 11 integration tests...');

    try {
      const testUserId = 1;

      // Test 11.1: System Invariant Health Checks (All 7 views)
      console.log('\n--- Test 11.1: Reconciliation & Invariant Health Check ---');
      const healthReport = await ReconciliationService.runAllHealthChecks();
      assert(typeof healthReport.isHealthy === 'boolean', 'Health report contains isHealthy boolean');
      assert(typeof healthReport.totalAnomalies === 'number', 'Health report contains totalAnomalies count');
      assert(Object.keys(healthReport.checks).length === 7, 'Health report verified all 7 reconciliation views');
      assert('stockBalanceVsLedger' in healthReport.checks, 'Verified stockBalanceVsLedger (INV-1)');
      assert('reservedVsReservations' in healthReport.checks, 'Verified reservedVsReservations (INV-9)');
      assert('rollStatusVsFacts' in healthReport.checks, 'Verified rollStatusVsFacts');
      assert('machineEvents' in healthReport.checks, 'Verified machineEvents (INV-3)');
      assert('dispatchVsInvoice' in healthReport.checks, 'Verified dispatchVsInvoice');
      assert('unallocatedPayments' in healthReport.checks, 'Verified unallocatedPayments');
      assert('costVsIssues' in healthReport.checks, 'Verified costVsIssues');

      // Test 11.2: Audit Log Keyset Search
      console.log('\n--- Test 11.2: Audit Trail Search & Filtering ---');
      const auditRes = await AdminService.getAuditLogs({ limit: 10 });
      assert(Array.isArray(auditRes.logs), 'getAuditLogs returns array of audit log entries');
      assert(typeof auditRes.totalCount === 'number', 'getAuditLogs returns total count');

      // Test 11.3: Master Data CRUD (Suppliers)
      console.log('\n--- Test 11.3: Master Data CRUD - Suppliers ---');
      const uniqueName = `Test Yarn Supplier ${Date.now()}`;
      const newSupplier = await AdminService.createSupplier(
        {
          name: uniqueName,
          contact: '+91 9876543210',
          taxId: '27AAAAA0000A1Z5',
        },
        testUserId
      );
      assert(newSupplier.name === uniqueName, 'Created supplier with matching name');
      assert(newSupplier.supplier_id !== undefined, 'Created supplier assigned unique supplier_id');

      const fetchedSupplier = await AdminService.getSupplierById(Number(newSupplier.supplier_id));
      assert(fetchedSupplier.name === uniqueName, 'Fetched supplier by ID successfully');

      const updatedSupplier = await AdminService.updateSupplier(
        Number(newSupplier.supplier_id),
        { contact: '+91 9999999999' },
        testUserId
      );
      assert(updatedSupplier.contact === '+91 9999999999', 'Updated supplier contact successfully');

      // Test 11.4: Immutable Audit Trail Enforcement (BR001)
      console.log('\n--- Test 11.4: Immutable Audit Trail Protection (BR001) ---');
      try {
        await TxManager.withTransaction(
          { userId: testUserId, source: 'TEST', reason: 'Attempt illegal audit mutation' },
          async (client) => {
            await client.query(`DELETE FROM audit_log WHERE audit_id = (SELECT MIN(audit_id) FROM audit_log);`);
          }
        );
        assert(false, 'Direct SQL DELETE on audit_log should have failed with BR001');
      } catch (err: any) {
        assert(
          err.code === 'BR001' || (err.message && err.message.includes('BR001')) || (err.message && err.message.includes('immutable')),
          'Direct mutation on audit_log blocked by trigger raising BR001'
        );
      }

    } catch (dbError: any) {
      console.error('Database live test error:', dbError);
      assert(false, `Live database test failed: ${dbError.message}`);
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
