import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Global pool to prevent creating new connection pools across hot reloads & worker bundles
const globalForDb = globalThis as unknown as {
    pool?: Pool;
    db?: ReturnType<typeof drizzle>;
};

const pool = globalForDb.pool ?? new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 20, // Maximum concurrent connections
    idleTimeoutMillis: 20000, // Close idle connections after 20s to prevent stale/deadlock leaks
    connectionTimeoutMillis: 10000, // 10s timeout to acquire connection before failing fast
    statement_timeout: 15000, // Auto-kill queries running longer than 15s to prevent database lockups
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
});

// Guardrails against hung transactions on Postgres level
pool.on('connect', (client) => {
    // Automatically terminate transactions that remain idle for > 10 seconds
    client.query('SET idle_in_transaction_session_timeout = 10000;').catch(() => undefined);
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle database client:', err.message);
});

// Always store in globalThis to prevent duplicate pools across Next.js standalone chunks/workers
if (!globalForDb.pool) {
    globalForDb.pool = pool;
}

export const db = globalForDb.db ?? drizzle(pool, { schema });
if (!globalForDb.db) {
    globalForDb.db = db;
}