import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  
  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
  DB_NAME: process.env.DB_NAME || 'textile_db',
  DB_POOL_MIN: parseInt(process.env.DB_POOL_MIN || '10', 10),
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '50', 10),
  DB_TIMEOUT_MS: parseInt(process.env.DB_TIMEOUT_MS || '5000', 10),
  DB_IDLE_TIMEOUT_MS: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '10000', 10),
  
  // Security & JWT
  JWT_SECRET: process.env.JWT_SECRET || 'everest_textile_jwt_super_secure_secret_2026_change_in_prod',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '12h',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'everest_textile_refresh_super_secret_2026',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // CORS & Rate Limiting
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
};
