-- Initialize the database with any required extensions or initial data
-- This script runs when the PostgreSQL container starts for the first time

-- Enable UUID extension (commonly used for primary keys)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto extension (for password hashing and crypto functions)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Safeguards against connection pool exhaustion and runaway locks (e.g. from Power BI or idle workers)
ALTER SYSTEM SET idle_session_timeout = '60000';
ALTER SYSTEM SET idle_in_transaction_session_timeout = '15000';
ALTER SYSTEM SET statement_timeout = '60000';
ALTER SYSTEM SET tcp_keepalives_idle = '60';
ALTER SYSTEM SET tcp_keepalives_interval = '10';
ALTER SYSTEM SET tcp_keepalives_count = '3';
ALTER SYSTEM SET checkpoint_completion_target = '0.9';
ALTER SYSTEM SET max_connections = '200';
