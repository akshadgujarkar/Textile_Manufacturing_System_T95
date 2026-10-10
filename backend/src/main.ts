import { createApp } from './app';
import { env } from './config/environment';
import { dbPool, testDatabaseConnection } from './config/database';

async function bootstrap() {
  console.log('====================================================');
  console.log('Starting Everest Textile TMS Backend Server...');
  console.log('====================================================');

  // Verify Database Connection
  const isDbConnected = await testDatabaseConnection();
  if (!isDbConnected) {
    console.warn('[WARN] Initial database connection check failed. Server will start and retry connections via pool.');
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`[HTTP SERVER READY] Server listening on port ${env.PORT} in [${env.NODE_ENV}] mode.`);
    console.log(`[HEALTH ENDPOINT] http://localhost:${env.PORT}/api/health`);
  });

  // Graceful shutdown on termination signals
  const shutdown = async (signal: string) => {
    console.log(`\n[${signal} RECEIVED] Closing HTTP server and database pool...`);
    server.close(async () => {
      console.log('[HTTP SERVER CLOSED] Active connections drained.');
      try {
        await dbPool.end();
        console.log('[DATABASE POOL CLOSED] All connections terminated cleanly.');
        process.exit(0);
      } catch (err) {
        console.error('[DATABASE POOL CLOSE ERROR]', err);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[FATAL BOOTSTRAP ERROR]', err);
  process.exit(1);
});
