import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('WARNING: DATABASE_URL is not set. Database features will not work.');
}

// For Neon PostgreSQL in production autoscale, use the pooler endpoint
if (databaseUrl && process.env.NODE_ENV === 'production') {
  if (databaseUrl.includes('.aws.neon.tech') && !databaseUrl.includes('-pooler')) {
    databaseUrl = databaseUrl.replace(/@([^.]+)\./, '@$1-pooler.');
    console.log('Using Neon connection pooler for production');
  }
}

const useSSL = databaseUrl?.includes('neon.tech') || process.env.NODE_ENV === 'production';

export const pool = new Pool({ 
  connectionString: databaseUrl || 'postgresql://localhost:5432/placeholder',
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err: any) => {
  if (err.code === '57P01') {
    console.log('Database connection terminated by server (Neon sleep). Will reconnect on next request.');
  } else {
    console.error('PostgreSQL pool error:', err.message);
  }
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

export const db = drizzle(pool, { schema });

export const isDatabaseConfigured = !!process.env.DATABASE_URL;

export let isDatabaseReady = false;

export async function waitForDatabase(maxRetries = 5): Promise<boolean> {
  if (!isDatabaseConfigured) {
    console.log('Database not configured, skipping warm-up');
    return false;
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log(`Database ready (attempt ${attempt}/${maxRetries})`);
      isDatabaseReady = true;
      return true;
    } catch (err: any) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      
      if (err.code === '57P01') {
        console.log(`Database waking up (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
      } else {
        console.log(`Database connection failed (attempt ${attempt}/${maxRetries}): ${err.message}, retrying in ${delay}ms...`);
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.warn('Database warm-up failed after all retries. Server will start in degraded mode.');
  isDatabaseReady = false;
  return false;
}
