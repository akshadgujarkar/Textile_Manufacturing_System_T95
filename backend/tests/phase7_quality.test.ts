import { QualityService } from '../src/modules/quality/quality.service';
import { createApp } from '../src/app';
import { TxManager } from '../src/database/tx-manager';
import { CryptoUtil } from '../src/utils/crypto';
import { v4 as uuidv4 } from 'uuid';

async function runTests() {
  console.log('🧪 =========================================================');
  console.log('🧪 RUNNING PHASE 7 QUALITY CONTROL & TRACEABILITY TEST SUITE');
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
    console.log('Database connected. Running live QC integration tests...');

    try {
      const testUserId = 1;

      // 1. Ensure a defect type exists
      let defectType = await TxManager.queryOne<{ defect_type_id: string }>(
        `SELECT defect_type_id FROM defect_type WHERE is_active = true LIMIT 1`
      );
      if (!defectType) {
        defectType = await TxManager.queryOne<{ defect_type_id: string }>(
          `INSERT INTO defect_type (name) VALUES ('Weft Slub') RETURNING defect_type_id`
        );
      }

      // 2. Ensure an inspector employee exists
      let inspector = await TxManager.queryOne<{ employee_id: string }>(
        `SELECT employee_id FROM employee WHERE is_active = true LIMIT 1`
      );
      if (!inspector) {
        inspector = await TxManager.queryOne<{ employee_id: string }>(
          `INSERT INTO employee (employee_code, full_name, role) 
           VALUES ('EMP-QC-01', 'Rajesh Sharma', 'quality_checker') 
           RETURNING employee_id`
        );
      }

      // 3. Ensure a running or planned job exists for roll creation
      let job = await TxManager.queryOne<{ job_id: string }>(
        `SELECT job_id FROM production_job WHERE status IN ('running', 'completed') LIMIT 1`
      );

      let roll = await TxManager.queryOne<{ roll_id: string; roll_code: string; status: string }>(
        `SELECT roll_id, roll_code, status FROM fabric_roll WHERE status = 'pending_qc' LIMIT 1`
      );

      if (!roll && job) {
        roll = await TxManager.queryOne<{ roll_id: string; roll_code: string; status: string }>(
          `INSERT INTO fabric_roll (job_id, client_request_id, length_m, weight_kg, status, shelf_location)
           VALUES ($1, $2, 120.0, 35.0, 'pending_qc', 'RACK-B-02')
           RETURNING roll_id, roll_code, status`,
          [job.job_id, uuidv4()]
        );
      }

      if (roll && inspector && defectType) {
        console.log('\n--- Test 7.1: Fetch Roll Details by Code ---');
        const rollDetails = await QualityService.getRollByCode(roll.roll_code);
        assert(rollDetails.roll_code === roll.roll_code, 'Fetched roll details matching roll code');
        assert(rollDetails.roll_status === 'pending_qc', 'Roll initial status is pending_qc');
        assert(Array.isArray(rollDetails.inspections), 'Roll includes inspection history array');

        console.log('\n--- Test 7.2: Invariant Check - Critical Defect Cannot Pass ---');
        let criticalPassBlocked = false;
        try {
          await QualityService.recordInspection(
            {
              rollCode: roll.roll_code,
              inspectorId: Number(inspector.employee_id),
              result: 'passed',
              remarks: 'Test attempt with critical defect',
              defects: [
                {
                  defectTypeId: Number(defectType.defect_type_id),
                  severity: 'critical',
                  defectCount: 2,
                },
              ],
            },
            testUserId
          );
        } catch (err: any) {
          criticalPassBlocked = err.message.startsWith('CRITICAL_DEFECT_NOT_PASSABLE');
        }
        assert(criticalPassBlocked, 'Passing a roll with critical defect correctly rejected by QC rules');

        console.log('\n--- Test 7.3: Record Successful Inspection (Passed -> in_stock) ---');
        const passedIns = await QualityService.recordInspection(
          {
            rollCode: roll.roll_code,
            inspectorId: Number(inspector.employee_id),
            result: 'passed',
            remarks: 'High grade finish, zero critical defects',
            defects: [
              {
                defectTypeId: Number(defectType.defect_type_id),
                severity: 'minor',
                defectCount: 1,
                positionNote: 'Near selvedge at 15m mark',
              },
            ],
          },
          testUserId
        );

        assert(passedIns.inspection.result === 'passed', 'Inspection recorded with passed result');
        assert(passedIns.inspection.attempt_no === 1, 'First inspection recorded attempt_no = 1');
        assert(passedIns.roll.status === 'in_stock', 'Fabric roll status transitioned to "in_stock"');

        console.log('\n--- Test 7.4: Complete Traceability Dossier (v_roll_trace) ---');
        const trace = await QualityService.getRollTrace(roll.roll_code);
        assert(trace.roll_code === roll.roll_code, 'Traceability dossier matches roll code');
        assert(trace.roll_status === 'in_stock', 'Trace reflects updated in_stock status');
        assert(trace.latest_qc_result === 'passed', 'Trace shows latest QC inspection result');

        console.log('\n--- Test 7.5: Shelf Inventory Query ---');
        const shelfInv = await QualityService.getShelfInventory({ limit: 10 });
        assert(Array.isArray(shelfInv.data), 'Shelf inventory returned array from in_stock rolls');
        assert(shelfInv.data.some(r => r.roll_code === roll!.roll_code), 'Inspected roll is present in shelf inventory');

        console.log('\n--- Test 7.6: Defect Analytics Queries ---');
        const machineAnalytics = await QualityService.getDefectAnalyticsMachines();
        assert(Array.isArray(machineAnalytics), 'getDefectAnalyticsMachines returned array');

        const opAnalytics = await QualityService.getDefectAnalyticsOperators();
        assert(Array.isArray(opAnalytics), 'getDefectAnalyticsOperators returned array');
      }
    } catch (dbErr: any) {
      console.error('Database test error:', dbErr);
      failed++;
    }
  } else {
    console.log('Database not accessible during offline test run, validating application definitions.');
  }

  console.log('\n--- Test Suite: HTTP Express Routing & Quality Checker Token ---');
  try {
    const app = createApp();
    assert(typeof app === 'function', 'Express application initialized with quality routes');

    const qcToken = CryptoUtil.generateAccessToken({
      userId: 4,
      username: 'qc_inspector_1',
      employeeId: 104,
      roles: ['quality_checker'],
    });
    assert(typeof qcToken === 'string' && qcToken.length > 20, 'Generated valid JWT token for quality_checker role');
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
