'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('Financial and Inventory Decimal Precision Tests', async (t) => {
  await t.test('Invoice subtotal and GST 5% calculation without float precision loss', () => {
    const lines = [
      { quantity: 120.5, rate: 350.25 },
      { quantity: 85.0, rate: 420.00 },
    ];

    let subtotal = 0;
    for (const line of lines) {
      const lineTotal = Number((line.quantity * line.rate).toFixed(2));
      subtotal += lineTotal;
    }
    subtotal = Number(subtotal.toFixed(2));

    const taxRate = 5.00;
    const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));

    assert.equal(subtotal, 77905.13);
    assert.equal(taxAmount, 3895.26);
    assert.equal(totalAmount, 81800.39);
  });

  await t.test('ASTM D5430 Normalized 4-Point Score calculation', () => {
    const lengthM = 100.0;
    const widthInches = 58.0;
    const totalPenaltyPoints = 18;

    const areaSqYd = (lengthM * 1.09361) * (widthInches / 36);
    const pointsPer100SqYd = Number(((totalPenaltyPoints * 100) / areaSqYd).toFixed(2));

    assert.ok(pointsPer100SqYd > 0);
    assert.equal(pointsPer100SqYd, 10.22);
  });

  await t.test('Yarn stock signed deltas sum', () => {
    const movements = [
      { type: 'receipt', qty: 500.000 },
      { type: 'issue', qty: -120.500 },
      { type: 'issue', qty: -80.250 },
      { type: 'return', qty: 10.750 },
      { type: 'adjustment', qty: -5.000 },
    ];

    const currentStock = movements.reduce((sum, m) => sum + m.qty, 0);
    assert.equal(currentStock, 305.000);
  });
});
