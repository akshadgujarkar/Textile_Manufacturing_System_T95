import { WorkforceService } from '../src/modules/workforce/workforce.service';
import { FinanceService } from '../src/modules/finance/finance.service';
import { ExecutiveService } from '../src/modules/executive/executive.service';
import { createApp } from '../src/app';
import { TxManager } from '../src/database/tx-manager';
import { CryptoUtil } from '../src/utils/crypto';

async function runTests() {
  console.log('🧪 =========================================================');
  console.log('🧪 RUNNING PHASE 10 WORKFORCE, PERIOD CLOSE & P&L TEST SUITE');
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

  const accountsToken = CryptoUtil.generateAccessToken({
    userId: 1,
    username: 'accountant_user',
    roles: ['accounts'],
  });
  assert(typeof accountsToken === 'string' && accountsToken.length > 20, 'Generated valid JWT token for accounts role');

  const operatorToken = CryptoUtil.generateAccessToken({
    userId: 2,
    username: 'operator_user',
    roles: ['operator'],
  });
  assert(typeof operatorToken === 'string' && operatorToken.length > 20, 'Generated valid JWT token for operator role');

  // Check if database is connected
  const isDbConnected = await TxManager.queryOne<{ ok: number }>('SELECT 1 as ok').then(() => true).catch(() => false);

  if (isDbConnected) {
    console.log('\nDatabase connected. Running live Phase 10 integration tests...');

    try {
      const testUserId = 1;

      // Ensure an active shift exists
      let shift = await TxManager.queryOne<{ shift_id: string }>(
        `SELECT shift_id FROM shift LIMIT 1;`
      );
      if (!shift) {
        shift = await TxManager.queryOne<{ shift_id: string }>(
          `INSERT INTO shift (name, start_time, end_time) VALUES ('Morning Shift', '08:00:00', '16:00:00') RETURNING shift_id;`
        );
      }

      // Ensure an active employee exists
      let emp = await TxManager.queryOne<{ employee_id: string; pay_rate: string; pay_basis: string }>(
        `SELECT employee_id, pay_rate, pay_basis FROM employee WHERE is_active = true LIMIT 1;`
      );
      if (!emp) {
        emp = await TxManager.queryOne<{ employee_id: string; pay_rate: string; pay_basis: string }>(
          `INSERT INTO employee (employee_code, full_name, designation, pay_basis, pay_rate, is_active)
           VALUES ('EMP-TEST-99', 'Ramesh Kumar', 'Weaver', 'daily', 650.00, true)
           RETURNING employee_id, pay_rate, pay_basis;`
        );
      }

      // Ensure an open accounting period exists
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const start = `${year}-${month}-01`;
      const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
      const end = `${year}-${month}-${lastDay}`;

      let period = await TxManager.queryOne<{ period_id: string; status: string }>(
        `SELECT period_id, status FROM accounting_period WHERE status = 'open' LIMIT 1;`
      );

      if (!period) {
        period = await TxManager.queryOne<{ period_id: string; status: string }>(
          `INSERT INTO accounting_period (period_start, period_end, status)
           VALUES ($1::date, $2::date, 'open')
           RETURNING period_id, status;`,
          [start, end]
        );
      }

      if (!period || !emp || !shift) {
        throw new Error('SETUP_ERROR: Failed to initialize test fixtures (period, emp, or shift).');
      }

      const periodId = Number(period.period_id);
      const empId = Number(emp.employee_id);
      const shiftId = Number(shift.shift_id);

      // Test 10.1: Batch Record Attendance (WF-13a)
      console.log('\n--- Test 10.1: Record Daily Attendance (WF-13a) ---');
      const workDate = `${year}-${month}-05`;
      const attRes = await WorkforceService.recordAttendance(
        [
          {
            employeeId: empId,
            workDate: workDate,
            shiftId: shiftId,
            status: 'present',
            hoursWorked: 8.0,
          },
        ],
        testUserId
      );

      assert(attRes.recordedCount === 1, 'Recorded 1 attendance record successfully');
      assert(attRes.records[0].status === 'present', 'Attendance status saved as present');

      // Test 10.2: Generate Draft Monthly Wages (WF-13b)
      console.log('\n--- Test 10.2: Generate Draft Wages (WF-13b) ---');
      const wageGenRes = await WorkforceService.generateMonthlyWages(periodId, testUserId);
      assert(wageGenRes.periodId === periodId, 'Wages generated for target accounting period');
      assert(wageGenRes.generatedCount > 0, 'Generated wage records for active employees');

      const targetWage = wageGenRes.wages.find((w: any) => Number(w.employee_id) === empId);
      assert(targetWage !== undefined, 'Found wage record for test employee');
      assert(targetWage?.status === 'draft', 'Generated wage record status is draft');

      // Test 10.3: Wage Redaction for Non-Finance Roles
      console.log('\n--- Test 10.3: Sensitive Salary & Pay Rate Redaction ---');
      const financeWages = await WorkforceService.getWageSummary(periodId, 'accounts');
      const nonFinanceWages = await WorkforceService.getWageSummary(periodId, 'operator');

      const finRow = financeWages.find((w) => Number(w.employee_id) === empId);
      const nonFinRow = nonFinanceWages.find((w) => Number(w.employee_id) === empId);

      assert(finRow !== undefined && finRow.pay_rate !== null, 'Finance role (accounts) can view employee pay_rate');
      assert(nonFinRow !== undefined && nonFinRow.pay_rate === null, 'Non-finance role (operator) pay_rate is redacted (null)');
      assert(nonFinRow?.basis_note === '[REDACTED]', 'Non-finance role basis_note is redacted');

      // Test 10.4: Approve Wage Record & Plant-Level Cost Entry (WF-13c)
      console.log('\n--- Test 10.4: Approve Wage & Cost Ledger Entry (WF-13c) ---');
      const wageId = Number(targetWage.wage_id);
      const apprWage = await WorkforceService.approveWageRecord(wageId, testUserId);
      assert(apprWage.status === 'approved', 'Wage record status transitioned to approved');
      assert(apprWage.approved_at !== null, 'approved_at timestamp populated');

      // Verify that trigger trg_wage_cost automatically created cost_entry
      const costEntry = await TxManager.queryOne<{ cost_id: string; cost_type: string; amount: string }>(
        `SELECT cost_id, cost_type, amount FROM cost_entry WHERE wage_id = $1;`,
        [wageId]
      );
      assert(costEntry !== null && costEntry.cost_type === 'wage', 'Wage approval automatically created plant-level cost_entry');

      // Test 10.5: Executive Reporting Views
      console.log('\n--- Test 10.5: Executive P&L & Cost Analytics Views ---');
      const plStatement = await ExecutiveService.getExecutivePL(periodId);
      assert(Array.isArray(plStatement), 'getExecutivePL returns array from v_monthly_pl');
      if (plStatement.length > 0) {
        assert('net_profit_loss' in plStatement[0], 'Monthly P&L contains net_profit_loss field');
        assert('total_operating_expenses' in plStatement[0], 'Monthly P&L contains total_operating_expenses');
      }

      const orderCosts = await ExecutiveService.getOrderCosting();
      assert(Array.isArray(orderCosts), 'getOrderCosting returns array from v_order_cost');

      const rollCosts = await ExecutiveService.getRollCosting();
      assert(Array.isArray(rollCosts), 'getRollCosting returns array from v_roll_cost');

      const machineOutput = await ExecutiveService.getMachineProductivity(periodId);
      assert(Array.isArray(machineOutput), 'getMachineProductivity returns array from v_machine_output');

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
