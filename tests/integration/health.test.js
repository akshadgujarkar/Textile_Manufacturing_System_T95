'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../../src/app');

test('Integration: App Infrastructure & Health Routes', async (t) => {
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

  await t.test('GET /api/v1/health returns ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'ok');
  });

  await t.test('Response includes X-Request-ID header', async () => {
    const res = await fetch(`${baseUrl}/health`);
    const reqId = res.headers.get('x-request-id');
    assert.ok(reqId, 'X-Request-ID must be present');
  });

  await t.test('Unknown route returns 404 with standard error format', async () => {
    const res = await fetch(`${baseUrl}/non-existent-route`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  await t.test('POST /api/v1/employees without body returns 400 validation error', async () => {
    const res = await fetch(`${baseUrl}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(body.error.details));
  });
});
