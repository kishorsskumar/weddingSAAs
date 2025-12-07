import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('WARNING: DATABASE_URL is not set. Database features will not work.');
}

// For Neon PostgreSQL in production autoscale, use the pooler endpoint
// This is critical for autoscale deployments as the database may sleep
if (databaseUrl && process.env.NODE_ENV === 'production') {
  // Convert to pooler endpoint if using Neon
  // Neon URL format: ep-xyz-123456.region.aws.neon.tech
  // Pooler format: ep-xyz-123456-pooler.region.aws.neon.tech
  if (databaseUrl.includes('.aws.neon.tech') && !databaseUrl.includes('-pooler')) {
    // Add -pooler before the first dot after @ in the hostname
    databaseUrl = databaseUrl.replace(/@([^.]+)\./, '@$1-pooler.');
    console.log('Using Neon connection pooler for production');
  }
}

// Determine if SSL should be used (required for Neon in production)
const useSSL = databaseUrl?.includes('neon.tech') || process.env.NODE_ENV === 'production';

export const pool = new Pool({ 
  connectionString: databaseUrl || 'postgresql://localhost:5432/placeholder',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

export const db = drizzle(pool, { schema });

export const isDatabaseConfigured = !!process.env.DATABASE_URL;
