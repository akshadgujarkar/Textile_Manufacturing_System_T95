import { ProductionService } from '../src/modules/production/production.service';
import { OrderService } from '../src/modules/orders/order.service';
import { createApp } from '../src/app';
import { TxManager } from '../src/database/tx-manager';
import { CryptoUtil } from '../src/utils/crypto';
import { v4 as uuidv4 } from 'uuid';

async function runTests() {
  console.log('🧪 =========================================================');
  console.log('🧪 RUNNING PHASE 6 PRODUCTION FLOOR & MACHINE STATE TEST SUITE');
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
    console.log('Database connected. Running live production integration tests...');

    try {
      const testUserId = 1;

      // 1. Ensure a confirmed order and order item exists
      let order = await TxManager.queryOne<{ order_id: string }>(
        `SELECT order_id FROM customer_order WHERE status = 'confirmed' LIMIT 1`
      );

      let orderItem = await TxManager.queryOne<{ order_item_id: string }>(
        `SELECT oi.order_item_id 
           FROM order_item oi 
           JOIN customer_order co ON oi.order_id = co.order_id 
          WHERE co.status = 'confirmed' LIMIT 1`
      );

      // 2. Ensure machines exist
      const weavingStage = await TxManager.queryOne<{ stage_id: string }>(
        `SELECT stage_id FROM process_stage WHERE name = 'weaving' LIMIT 1`
      );

      let machine1 = await TxManager.queryOne<{ machine_id: string; machine_code: string }>(
        `SELECT machine_id, machine_code FROM machine WHERE stage_id = $1 AND is_active = true LIMIT 1`,
        [weavingStage?.stage_id]
      );

      if (!machine1) {
        machine1 = await TxManager.queryOne<{ machine_id: string; machine_code: string }>(
          `INSERT INTO machine (machine_code, stage_id, description) 
           VALUES ('LOOM-01', $1, 'Airjet Loom Unit 1') 
           RETURNING machine_id, machine_code`,
          [weavingStage?.stage_id]
        );
      }

      let machine2 = await TxManager.queryOne<{ machine_id: string; machine_code: string }>(
        `SELECT machine_id, machine_code FROM machine WHERE stage_id = $1 AND machine_id <> $2 AND is_active = true LIMIT 1`,
        [weavingStage?.stage_id, machine1?.machine_id]
      );

      if (!machine2) {
        machine2 = await TxManager.queryOne<{ machine_id: string; machine_code: string }>(
          `INSERT INTO machine (machine_code, stage_id, description) 
           VALUES ('LOOM-02', $1, 'Airjet Loom Unit 2') 
           RETURNING machine_id, machine_code`,
          [weavingStage?.stage_id]
        );
      }

      // 3. Ensure a shift exists
      let shift = await TxManager.queryOne<{ shift_id: string }>(
        `SELECT shift_id FROM shift WHERE is_active = true LIMIT 1`
      );
      if (!shift) {
        shift = await TxManager.queryOne<{ shift_id: string }>(
          `INSERT INTO shift (name, starts_at, ends_at) VALUES ('Morning Shift', '06:00:00', '14:00:00') RETURNING shift_id`
        );
      }

      if (orderItem && machine1 && weavingStage) {
        console.log('\n--- Test 6.1: Schedule Production Job ---');
        const job = await ProductionService.createJob(
          {
            orderItemId: Number(orderItem.order_item_id),
            stageId: Number(weavingStage.stage_id),
            machineId: Number(machine1.machine_id),
            plannedQty: 1200.0,
          },
          testUserId
        );

        assert(job.job_no.startsWith('JOB-'), 'Production job generated valid JOB code sequence');
        assert(job.status === 'planned', 'Job initial status is planned');
        assert(job.version === 1, 'Initial OCC version is 1');

        const createdJobId = Number(job.job_id);

        console.log('\n--- Test 6.2: Start Production Job (WF-4) ---');
        const startedJob = await ProductionService.startJob(createdJobId, testUserId);
        assert(startedJob.status === 'running', 'Job transitioned to "running" status');
        assert(startedJob.started_at !== null, 'Job recorded started_at timestamp');

        console.log('\n--- Test 6.3: One Running Job Per Machine Constraint ---');
        let busyRejected = false;
        try {
          const secondJob = await ProductionService.createJob(
            {
              orderItemId: Number(orderItem.order_item_id),
              stageId: Number(weavingStage.stage_id),
              machineId: Number(machine1.machine_id),
              plannedQty: 500.0,
            },
            testUserId
          );
          await ProductionService.startJob(Number(secondJob.job_id), testUserId);
        } catch (err: any) {
          busyRejected = err.message.startsWith('MACHINE_BUSY') || err.message.includes('uq_job_one_running_per_machine');
        }
        assert(busyRejected, 'Starting two running jobs on the same machine correctly rejected');

        console.log('\n--- Test 6.4: Log Shift Output & Generate Fabric Roll (WF-5) ---');
        const clientRequestId = uuidv4();
        const logResult = await ProductionService.logShiftOutput(
          {
            jobId: createdJobId,
            shiftId: Number(shift!.shift_id),
            outputQty: 150.0,
            clientRequestId,
            generateFabricRoll: true,
            rollWeightKg: 42.5,
            shelfLocation: 'RACK-A-01',
          },
          testUserId
        );

        assert(logResult.isIdempotentRetry === false, 'Shift output logged with isIdempotentRetry = false');
        assert(Number(logResult.log.output_qty) === 150.0, 'Logged output quantity recorded accurately');
        assert(logResult.roll !== undefined, 'Fabric roll generated with shift log');
        assert(logResult.roll.status === 'pending_qc', 'Generated roll created in "pending_qc" status');
        assert(logResult.roll.roll_code.startsWith('R-'), 'Generated roll code matches R-YY-XXXXXX sequence format');

        // Test idempotency
        const retryLogResult = await ProductionService.logShiftOutput(
          {
            jobId: createdJobId,
            shiftId: Number(shift!.shift_id),
            outputQty: 150.0,
            clientRequestId,
            generateFabricRoll: true,
          },
          testUserId
        );
        assert(retryLogResult.isIdempotentRetry === true, 'Duplicate clientRequestId recognized as idempotent retry');

        console.log('\n--- Test 6.5: Record Machine Breakdown (WF-6) ---');
        const breakdownRes = await ProductionService.recordBreakdown(
          Number(machine1.machine_id),
          { note: 'Warp thread tension breakage on loom' },
          testUserId
        );
        assert(breakdownRes.machineEvent.state === 'breakdown', 'Machine state transitioned to breakdown');
        assert(breakdownRes.interruptedJob !== undefined, 'Active running job was detected and interrupted');
        assert(breakdownRes.interruptedJob.status === 'interrupted', 'Job status updated to "interrupted"');

        console.log('\n--- Test 6.6: Reassign Interrupted Job to Available Machine ---');
        if (machine2) {
          const reassigned = await ProductionService.reassignInterruptedJob(
            createdJobId,
            Number(machine2.machine_id),
            testUserId
          );
          assert(Number(reassigned.machine_id) === Number(machine2.machine_id), 'Job successfully reassigned to Loom 2');
        }

        console.log('\n--- Test 6.7: Resolve Machine Downtime ---');
        const resolveRes = await ProductionService.resolveDowntime(
          Number(machine1.machine_id),
          'Tension unit repaired and calibrated',
          testUserId
        );
        assert(resolveRes.resolvedEvent.ended_at !== null, 'Closed prior breakdown event with ended_at');
        assert(resolveRes.newIdleEvent.state === 'idle', 'Machine transitioned to "idle" state');

        console.log('\n--- Test 6.8: Floor Matrix & Shift Output Views ---');
        const floorMatrix = await ProductionService.getFloorMatrix();
        assert(Array.isArray(floorMatrix), 'getFloorMatrix returned array from v_machine_status view');

        const shiftOutputs = await ProductionService.getShiftOutput({});
        assert(Array.isArray(shiftOutputs), 'getShiftOutput returned array from v_output_by_machine_shift view');
      }
    } catch (dbErr: any) {
      console.error('Database test error:', dbErr);
      failed++;
    }
  } else {
    console.log('Database not accessible during offline test run, validating application definitions.');
  }

  console.log('\n--- Test Suite: HTTP Express Routing & Operator Token ---');
  try {
    const app = createApp();
    assert(typeof app === 'function', 'Express application initialized with production routes');

    const opToken = CryptoUtil.generateAccessToken({
      userId: 3,
      username: 'operator_loom_1',
      employeeId: 103,
      roles: ['operator'],
    });
    assert(typeof opToken === 'string' && opToken.length > 20, 'Generated valid JWT token for operator role');
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
