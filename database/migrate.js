'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../src/config/env');

async function runMigrations() {
  console.log('🔄 Connecting to MySQL for migrations...');
  
  // Connect without DB first to ensure database exists
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    console.log(`🔨 Ensuring database "${env.DB_NAME}" exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.changeUser({ database: env.DB_NAME });

    // Ensure migrations table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        migration_id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [appliedRows] = await connection.query(`SELECT filename FROM _schema_migrations`);
    const appliedFiles = new Set(appliedRows.map((r) => r.filename));

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`📂 Found ${files.length} migration files in total.`);

    let count = 0;
    for (const file of files) {
      if (appliedFiles.has(file)) {
        console.log(`  ⏭️  Skipping already applied: ${file}`);
        continue;
      }

      console.log(`  ▶️  Applying migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      
      await connection.query(sql);
      await connection.query(`INSERT INTO _schema_migrations (filename) VALUES (?)`, [file]);
      console.log(`  ✅ Applied: ${file}`);
      count++;
    }

    console.log(`\n🎉 Migrations complete. ${count} new migrations applied.`);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
