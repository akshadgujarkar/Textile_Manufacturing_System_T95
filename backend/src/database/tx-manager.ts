import { PoolClient } from 'pg';
import { dbPool } from '../config/database';
import { SessionContext } from '../types';

export interface TxOptions {
  isolationLevel?: 'READ COMMITTED' | 'REPEATABLE READ, READ ONLY';
  lockTimeout?: string;        // default '5s'
  statementTimeout?: string;   // default '15s'
}

export class TxManager {
  /**
   * Executes a callback within an atomic PostgreSQL transaction with mandatory session context propagation.
   * 
   * Transaction Contract (from Doc 05 §2.1):
   * 1. BEGIN [ISOLATION LEVEL]
   * 2. SELECT set_config('app.user_id', $1, true)
   * 3. SELECT set_config('app.source',  $2, true)
   * 4. SELECT set_config('app.reason',  $3, true)
   * 5. SET LOCAL lock_timeout = '5s'
   * 6. SET LOCAL statement_timeout = '15s'
   */
  static async withTransaction<T>(
    context: SessionContext,
    callback: (client: PoolClient) => Promise<T>,
    options: TxOptions = {}
  ): Promise<T> {
    const client = await dbPool.connect();
    const isolation = options.isolationLevel || 'READ COMMITTED';
    const lockTimeout = options.lockTimeout || '5s';
    const statementTimeout = options.statementTimeout || '15s';

    try {
      if (isolation === 'REPEATABLE READ, READ ONLY') {
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;');
      } else {
        await client.query('BEGIN;');
      }

      // 1. Mandatory Session Context for Trigger Auditing & created_by Attribution
      await client.query("SELECT set_config('app.user_id', $1::text, true);", [context.userId.toString()]);
      
      if (context.source) {
        await client.query("SELECT set_config('app.source', $1::text, true);", [context.source]);
      }
      
      if (context.reason) {
        await client.query("SELECT set_config('app.reason', $1::text, true);", [context.reason]);
      }

      // 2. Local Timeouts to Prevent Deadlocks and Connection Starvation
      await client.query(`SET LOCAL lock_timeout = '${lockTimeout}';`);
      await client.query(`SET LOCAL statement_timeout = '${statementTimeout}';`);

      // 3. Execute Workflow Callback
      const result = await callback(client);

      // 4. Commit Transaction
      await client.query('COMMIT;');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK;');
      } catch (rollbackErr) {
        console.error('[TX ROLLBACK ERROR]', rollbackErr);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Executes a read-only query using a pool client with automated release
   */
  static async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const client = await dbPool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows as T[];
    } finally {
      client.release();
    }
  }

  /**
   * Executes a single-row query returning null if not found
   */
  static async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }
}
