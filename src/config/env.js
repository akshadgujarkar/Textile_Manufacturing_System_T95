'use strict';

const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().min(1),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),
  DB_QUEUE_LIMIT: z.coerce.number().int().nonnegative().default(0),

  TEST_DB_HOST: z.string().optional(),
  TEST_DB_PORT: z.coerce.number().int().positive().optional().default(3306),
  TEST_DB_USER: z.string().optional(),
  TEST_DB_PASSWORD: z.string().optional(),
  TEST_DB_NAME: z.string().optional(),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

let env;
try {
  env = envSchema.parse(process.env);
} catch (err) {
  console.error('Invalid environment configuration:');
  if (err.errors) {
    err.errors.forEach((e) => console.error(`  ${e.path.join('.')}: ${e.message}`));
  }
  process.exit(1);
}

module.exports = env;
