'use strict';

require('dotenv').config();

const env = require('./config/env');
const app = require('./app');
const { closePool } = require('./config/database');

const server = app.listen(env.PORT, () => {
  console.log(`[server] Everest TMS running on port ${env.PORT} [${env.NODE_ENV}]`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`[server] ${signal} received — shutting down gracefully`);
  server.close(async () => {
    try {
      await closePool();
      console.log('[server] MySQL pool closed');
    } catch (err) {
      console.error('[server] Error closing MySQL pool:', err.message);
    }
    process.exit(0);
  });

  // Force kill after 15 seconds
  setTimeout(() => {
    console.error('[server] Forced shutdown after timeout');
    process.exit(1);
  }, 15000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
  shutdown('uncaughtException');
});
