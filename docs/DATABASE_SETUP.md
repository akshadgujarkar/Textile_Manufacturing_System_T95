# Database Setup Guide: Everest Textile Manufacturing System

## Prerequisites
- Node.js (v20+ LTS recommended)
- MySQL 8.0.16 or newer (supports enforced `CHECK` constraints and generated virtual columns)

## Configuration
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Set your MySQL credentials in `.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=everest_tms
   ```

## Running Migrations
To create the database and apply all 30 canonical table migrations in dependency order:
```bash
npm run migrate
```

This runs `database/migrate.js`, which:
- Automatically creates the `everest_tms` database if it does not exist.
- Creates the `_schema_migrations` tracking table.
- Sequentially applies migrations `001_unit_of_measure.sql` through `030_cost_entry.sql`.

## Seeding Initial Reference Data
To seed standard Units of Measure (`kg`, `m`, `pcs`, `cone`) and Process Stages (`spinning`, `winding`, `warping`, `sizing`, `weaving`, `dyeing`, `finishing`, `inspection`):
```bash
npm run seed
```

## Running the Development Server
```bash
npm run dev
# or
npm start
```
Server will start on `http://localhost:3000`.

## Health Check
Verify system status and live database pool connectivity:
- Application Health: `GET http://localhost:3000/api/v1/health`
- Database Ping: `GET http://localhost:3000/api/v1/health/database`
