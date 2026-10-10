'use strict';

require('dotenv').config();
const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('everest_tms'),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),
  DB_QUEUE_LIMIT: z.coerce.number().int().nonnegative().default(0),

  TEST_DB_HOST: z.string().optional().default('localhost'),
  TEST_DB_PORT: z.coerce.number().int().positive().optional().default(3306),
  TEST_DB_USER: z.string().optional().default('root'),
  TEST_DB_PASSWORD: z.string().optional().default(''),
  TEST_DB_NAME: z.string().optional().default('everest_tms_test'),

  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

let env;
try {
  env = envSchema.parse(process.env);
} catch (err) {
  console.error('Invalid environment configuration:');
  const issues = err.issues || err.errors || [];
  issues.forEach((e) => console.error(`  ${e.path?.join('.')}: ${e.message}`));
  process.exit(1);
}

module.exports = env;
