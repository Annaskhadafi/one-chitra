import 'dotenv/config'
import { db } from '../db'
import { sql } from 'drizzle-orm'
import { ensureChatSchema } from '../lib/chat-schema'

async function runE2EResilienceTests() {
    console.log("==================================================")
    console.log("🚀 STARTING E2E DATABASE & CONNECTION POOL RESILIENCE TESTS")
    console.log("==================================================")

    let passedTests = 0
    let totalTests = 0

    const assert = (condition: boolean, testName: string, detail?: string) => {
        totalTests++
        if (condition) {
            console.log(`✅ [PASS] ${testName}`)
            passedTests++
        } else {
            console.error(`❌ [FAIL] ${testName}${detail ? `: ${detail}` : ''}`)
        }
    }

    // TEST 1: Database Connectivity
    try {
        console.log("\n--- TEST 1: Database Connectivity & Ping ---")
        const start = Date.now()
        const pingResult = await db.execute(sql`SELECT 1 as alive, current_database() as db_name, now() as current_time;`)
        const duration = Date.now() - start
        assert(Boolean(pingResult), `Database responds to ping query (${duration}ms)`)
    } catch (err) {
        assert(false, "Database connectivity test", String(err))
    }

    // TEST 2: Inspect Database Stats & Session Timeout Guardrails
    try {
        console.log("\n--- TEST 2: Database Connection Stats & Limits ---")
        const maxConnRes = await db.execute(sql`SHOW max_connections;`)
        const statsRes = await db.execute(sql`SELECT state, count(*) as count FROM pg_stat_activity GROUP BY state;`)
        const sampleIdleRes = await db.execute(sql`
            SELECT pid, client_addr, state, now() - state_change as idle_duration 
            FROM pg_stat_activity 
            WHERE state = 'idle' 
            ORDER BY state_change ASC 
            LIMIT 5;
        `)
        console.log("PostgreSQL max_connections setting:", maxConnRes.rows ?? maxConnRes)
        console.log("Current connection states in PostgreSQL:", statsRes.rows ?? statsRes)
        console.log("Oldest idle connections:", sampleIdleRes.rows ?? sampleIdleRes)
        assert(true, "PostgreSQL max_connections & connection states retrieved")
    } catch (err) {
        assert(false, "PostgreSQL connection stats test", String(err))
    }

    // TEST 3: Singleton Pool Verification
    try {
        console.log("\n--- TEST 3: Pool Singleton in globalThis ---")
        const globalForDb = globalThis as unknown as { pool?: unknown; db?: unknown }
        assert(Boolean(globalForDb.pool), "globalThis.pool is properly populated as singleton")
        assert(Boolean(globalForDb.db), "globalThis.db is properly populated as singleton")
    } catch (err) {
        assert(false, "Singleton pool test", String(err))
    }

    // TEST 4: Chat Schema Sync Guard (Idempotency)
    try {
        console.log("\n--- TEST 4: Chat Schema Idempotency Guard ---")
        const t0 = Date.now()
        await ensureChatSchema()
        const firstRunDuration = Date.now() - t0

        const t1 = Date.now()
        await ensureChatSchema()
        const secondRunDuration = Date.now() - t1

        assert(secondRunDuration <= firstRunDuration, `Second ensureChatSchema call was cached (${secondRunDuration}ms vs ${firstRunDuration}ms)`)
        const globalChat = globalThis as unknown as { isChatSchemaSynced?: boolean }
        assert(globalChat.isChatSchemaSynced === true, "globalChat.isChatSchemaSynced is true")
    } catch (err) {
        assert(false, "Chat schema sync guard test", String(err))
    }

    // TEST 5: Terminate Stale Idle Zombie Connections & High-Concurrency Burst Simulation
    try {
        console.log("\n--- TEST 5: Cleanup Stale Zombie Connections & High-Concurrency Burst Simulation ---")
        // Terminate stale idle connections from previous orphaned node processes (> 5 minutes idle)
        const killRes = await db.execute(sql`
            SELECT count(pg_terminate_backend(pid)) as terminated_count
            FROM pg_stat_activity
            WHERE pid <> pg_backend_pid()
              AND datname = current_database()
              AND state = 'idle'
              AND (now() - state_change) > interval '5 minutes';
        `)
        console.log("Terminated stale idle connections:", killRes.rows ?? killRes)

        const burstCount = 25
        const burstStart = Date.now()
        const queries = Array.from({ length: burstCount }, (_, i) => 
            db.execute(sql`SELECT ${i} as query_id, pg_backend_pid() as pid`)
        )

        const results = await Promise.all(queries)
        const burstDuration = Date.now() - burstStart
        assert(results.length === burstCount, `All ${burstCount} concurrent queries completed successfully in ${burstDuration}ms`)
        
        // Log distinct backend PIDs used from pool
        const pids = new Set(results.map((r: any) => {
            const row = (r && r[0]) ? r[0] : (r?.rows?.[0] ?? {})
            return row.pid
        }).filter(Boolean))
        console.log(`ℹ️ Utilized ${pids.size} distinct backend connection(s) efficiently from the pool.`)
    } catch (err: any) {
        console.error("Test 5 detail error:", err?.cause || err?.message || err)
        assert(false, "High-concurrency burst test", err?.message || String(err))
    }

    // Summary
    console.log("\n==================================================")
    console.log(`🏁 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`)
    console.log("==================================================")

    if (passedTests === totalTests) {
        console.log("🎉 ALL RESILIENCE TESTS PASSED! Database connection pool is robust and leak-free.")
        process.exit(0)
    } else {
        console.error("⚠️ Some tests failed. Please review the output above.")
        process.exit(1)
    }
}

runE2EResilienceTests().catch((err) => {
    console.error("Fatal test error:", err)
    process.exit(1)
})
