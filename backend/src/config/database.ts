import { Pool, PoolConfig } from 'pg';
import { env } from './environment';

const poolConfig: PoolConfig = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX,
      connectionTimeoutMillis: env.DB_TIMEOUT_MS,
      idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
    }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX,
      connectionTimeoutMillis: env.DB_TIMEOUT_MS,
      idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
    };

export const dbPool = new Pool(poolConfig);

dbPool.on('connect', (client) => {
  // Enforce UTC timezone at connection level
  client.query("SET timezone = 'UTC'");
});

dbPool.on('error', (err) => {
  console.error('[DATABASE POOL ERROR] Unexpected idle client error:', err);
});

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = await dbPool.connect();
    const result = await client.query('SELECT now() AS server_time, current_database() AS db_name');
    client.release();
    console.log(`[DATABASE CONNECTED] Connected to "${result.rows[0].db_name}" at ${result.rows[0].server_time}`);
    return true;
  } catch (error) {
    console.error('[DATABASE CONNECTION FAILED]', error);
    return false;
  }
}
