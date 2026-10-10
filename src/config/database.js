'use strict';

const mysql = require('mysql2/promise');
const env = require('./env');

/**
 * Create a MySQL connection pool.
 * Credentials are read from environment variables only.
 */
function createPool(overrides = {}) {
  const config = {
    host: overrides.host || env.DB_HOST,
    port: overrides.port || env.DB_PORT,
    user: overrides.user || env.DB_USER,
    password: overrides.password !== undefined ? overrides.password : env.DB_PASSWORD,
    database: overrides.database || env.DB_NAME,
    connectionLimit: overrides.connectionLimit || env.DB_CONNECTION_LIMIT,
    queueLimit: overrides.queueLimit || env.DB_QUEUE_LIMIT,
    waitForConnections: true,
    // Always store/read DATETIME in UTC
    timezone: '+00:00',
    // Return JS Date objects for DATETIME columns
    dateStrings: false,
    // Use decimal strings for DECIMAL columns to avoid JS float imprecision
    decimalNumbers: false,
    // Support multiple statements in migrations
    multipleStatements: false,
    // Enable named placeholders
    namedPlaceholders: false,
    // Strict mode for data integrity
    supportBigNumbers: true,
    bigNumberStrings: true,
  };

  const pool = mysql.createPool(config);

  /**
   * Execute a query with optional params. Returns [rows, fields].
   */
  pool.query2 = async function queryWithPool(sql, params) {
    return this.query(sql, params);
  };

  return pool;
}

// Default application pool — created lazily on first import
let _pool = null;

function getPool() {
  if (!_pool) {
    _pool = createPool();
  }
  return _pool;
}

/**
 * Verify the database is reachable by executing a trivial query.
 * Returns { ok: true, latency_ms } or throws on failure.
 */
async function checkDatabaseHealth() {
  const start = Date.now();
  const pool = getPool();
  const [rows] = await pool.query('SELECT 1 AS ping');
  if (!rows || Number(rows[0]?.ping) !== 1) {
    throw new Error('Unexpected ping response from MySQL');
  }
  return { ok: true, latency_ms: Date.now() - start };
}
/**
 * Run a callback inside a database transaction.
 * Automatically handles begin, commit, and rollback.
 */
async function withTransaction(callback) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Gracefully drain and close the pool.
 */
async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

module.exports = { getPool, createPool, checkDatabaseHealth, closePool, withTransaction };
