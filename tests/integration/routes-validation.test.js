'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../../src/app');

test('Integration: Module Endpoints Validation Tests', async (t) => {
  let server;
  let baseUrl;

  t.before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api/v1`;
        resolve();
      });
    });
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  await t.test('POST /api/v1/suppliers with missing supplier_code returns 400', async () => {
    const res = await fetch(`${baseUrl}/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme Yarn Mill' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  await t.test('POST /api/v1/buyers with missing buyer_code returns 400', async () => {
    const res = await fetch(`${baseUrl}/buyers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Global Apparel' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  await t.test('POST /api/v1/purchase-orders with empty items array returns 400', async () => {
    const res = await fetch(`${baseUrl}/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        po_no: 'PO-2026-0001',
        supplier_id: 1,
        order_date: '2026-03-01',
        created_by: 1,
        items: [],
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  await t.test('POST /api/v1/customer-orders with invalid date format returns 400', async () => {
    const res = await fetch(`${baseUrl}/customer-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_no: 'ORD-2026-0001',
        buyer_id: 1,
        order_date: '03/01/2026', // invalid date format (expected YYYY-MM-DD)
        created_by_employee_id: 1,
        items: [{ line_no: 1, product_id: 1, colour_code: 'NAVY', ordered_qty: 500, unit_id: 2, agreed_rate: 150 }],
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  await t.test('POST /api/v1/invoices with negative tax rate returns 400', async () => {
    const res = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_no: 'INV-2026-0001',
        buyer_id: 1,
        invoice_date: '2026-03-01',
        tax_rate: -5,
        items: [{ order_item_id: 1, quantity: 100, rate: 250 }],
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  await t.test('POST /api/v1/buyer-payments without UUID client_request_id returns 400', async () => {
    const res = await fetch(`${baseUrl}/buyer-payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_ref: 'UTR998877',
        buyer_id: 1,
        invoice_id: 1,
        received_on: '2026-03-01',
        amount: 50000,
        mode: 'NEFT/RTGS',
        client_request_id: 'not-a-valid-uuid',
        created_by_employee_id: 1,
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  await t.test('POST /api/v1/attendance-records with invalid hours (>24) returns 400', async () => {
    const res = await fetch(`${baseUrl}/attendance-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: 1,
        work_date: '2026-03-01',
        shift_code: 'SHIFT-A',
        status: 'present',
        hours_worked: 28,
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });
});
