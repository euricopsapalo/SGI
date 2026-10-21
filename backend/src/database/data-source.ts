import { DataSource } from 'typeorm';
import { readSecret } from './../config/read-secret';

// Load .env file if present (for CLI usage outside NestJS context)
require('dotenv').config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'app_user',
  password: readSecret('DB_PASSWORD') || 'app_password',
  database: process.env.DB_NAME || 'app_development',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
