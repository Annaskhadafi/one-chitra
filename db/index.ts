import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Global pool to prevent creating new connection pools on hot reloads
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool = globalForDb.pool ?? new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 25, // Maximum concurrent connections in pool
    idleTimeoutMillis: 30000, // Keep idle connections open for 30s to avoid repeated TCP handshakes
    connectionTimeoutMillis: 5000,
});

if (process.env.NODE_ENV !== 'production') {
    globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });