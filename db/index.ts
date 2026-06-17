import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    idleTimeoutMillis: 5000, // Automatically close idle connections after 5 seconds to prevent hanging build/dev tasks
});

export const db = drizzle(pool, { schema });