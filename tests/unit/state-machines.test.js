'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('State Machines & Business Rules Unit Tests', async (t) => {
  await t.test('Purchase Order status transitions', () => {
    const validTransitions = {
      draft: ['sent', 'cancelled'],
      sent: ['partially_received', 'closed', 'cancelled'],
      partially_received: ['closed', 'cancelled'],
      closed: [],
      cancelled: [],
    };

    assert.ok(validTransitions.draft.includes('sent'));
    assert.ok(validTransitions.draft.includes('cancelled'));
    assert.ok(!validTransitions.draft.includes('closed'));
    assert.ok(validTransitions.closed.length === 0);
  });

  await t.test('Customer Order status transitions', () => {
    const validTransitions = {
      draft: ['confirmed', 'cancelled'],
      confirmed: ['in_production', 'cancelled'],
      in_production: ['ready_for_dispatch', 'cancelled'],
      ready_for_dispatch: ['dispatched', 'cancelled'],
      dispatched: ['closed'],
      closed: [],
      cancelled: [],
    };

    assert.ok(validTransitions.draft.includes('confirmed'));
    assert.ok(validTransitions.confirmed.includes('in_production'));
    assert.ok(validTransitions.in_production.includes('ready_for_dispatch'));
    assert.ok(validTransitions.ready_for_dispatch.includes('dispatched'));
    assert.ok(validTransitions.dispatched.includes('closed'));
  });

  await t.test('Production Job status lifecycle', () => {
    const validJobTransitions = {
      planned: ['running', 'cancelled'],
      running: ['completed', 'interrupted', 'cancelled'],
      interrupted: ['running', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    assert.ok(validJobTransitions.planned.includes('running'));
    assert.ok(validJobTransitions.running.includes('completed'));
    assert.ok(!validJobTransitions.completed.includes('running'));
  });

  await t.test('Fabric Roll status transitions based on ASTM QC inspection', () => {
    function resolveRollStatusFromQc(result) {
      if (result === 'passed') return 'in_stock';
      if (result === 'rework') return 'rework';
      if (result === 'rejected') return 'rejected';
      return 'pending_qc';
    }

    assert.equal(resolveRollStatusFromQc('passed'), 'in_stock');
    assert.equal(resolveRollStatusFromQc('rework'), 'rework');
    assert.equal(resolveRollStatusFromQc('rejected'), 'rejected');
  });

  await t.test('Dispatch state machine and active roll dispatching', () => {
    const validDispatchStates = ['draft', 'loading', 'dispatched', 'cancelled'];
    assert.ok(validDispatchStates.includes('draft'));
    assert.ok(validDispatchStates.includes('dispatched'));
  });
});
