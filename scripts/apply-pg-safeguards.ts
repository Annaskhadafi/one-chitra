import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Script untuk menerapkan pengamanan koneksi di level engine PostgreSQL:
 * 1. idle_session_timeout = 60s (Otomatis menutup koneksi idle dari Power BI / eksternal)
 * 2. idle_in_transaction_session_timeout = 15s (Otomatis mematikan transaksi hung/terkunci)
 * 3. statement_timeout = 60s (Mencegah query berat mengunci database)
 * 4. tcp_keepalives (idle 60s, interval 10s, count 3: deteksi koneksi mati dalam 90 detik)
 * 5. checkpoint_completion_target = 0.9 (Meratakan beban I/O disk saat checkpoint)
 * 6. max_connections = 200 (Menaikkan kapasitas slot koneksi)
 */
async function applyPostgresSafeguards() {
  console.log('====================================================');
  console.log('🛡️ MENERAPKAN SAFEGUARDS KONEKSI & RESILIENSI POSTGRESQL');
  console.log('====================================================\n');

  try {
    // 1. Set timeouts
    await db.execute(sql`ALTER SYSTEM SET idle_session_timeout = '60000';`);
    console.log('✅ 1. idle_session_timeout diset ke 60000ms (60 detik)');

    await db.execute(sql`ALTER SYSTEM SET idle_in_transaction_session_timeout = '15000';`);
    console.log('✅ 2. idle_in_transaction_session_timeout diset ke 15000ms (15 detik)');

    await db.execute(sql`ALTER SYSTEM SET statement_timeout = '60000';`);
    console.log('✅ 3. statement_timeout diset ke 60000ms (60 detik)');

    // 2. Set TCP Keepalive
    await db.execute(sql`ALTER SYSTEM SET tcp_keepalives_idle = '60';`);
    await db.execute(sql`ALTER SYSTEM SET tcp_keepalives_interval = '10';`);
    await db.execute(sql`ALTER SYSTEM SET tcp_keepalives_count = '3';`);
    console.log('✅ 4. TCP Keepalive diset (idle: 60s, interval: 10s, count: 3)');

    // 3. Set Checkpoint I/O
    await db.execute(sql`ALTER SYSTEM SET checkpoint_completion_target = '0.9';`);
    console.log('✅ 5. checkpoint_completion_target diset ke 0.9');

    // 4. Set max_connections
    await db.execute(sql`ALTER SYSTEM SET max_connections = '200';`);
    console.log('✅ 6. max_connections diset ke 200 (aktif pada jadwal restart berikutnya)');

    // 5. Reload configuration tanpa restart database
    await db.execute(sql`SELECT pg_reload_conf();`);
    console.log('✅ 7. pg_reload_conf() sukses dieksekusi (perubahan langsung aktif)\n');

    // 6. Bersihkan koneksi idle lama yang sudah menggantung > 60s
    const killed: any = await db.execute(sql`
      SELECT count(pg_terminate_backend(pid)) as terminated
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
        AND state = 'idle'
        AND (now() - state_change) > interval '60 seconds';
    `);
    const terminatedCount = killed.rows ? killed.rows[0].terminated : (killed[0]?.terminated ?? 0);
    console.log(`🧹 8. Membersihkan sesi idle lama: ${terminatedCount} sesi ditutup.`);

    // 7. Tampilkan status koneksi terkini
    const currentStats: any = await db.execute(sql`
      SELECT coalesce(state, 'internal') as state, count(*) as count 
      FROM pg_stat_activity 
      GROUP BY state;
    `);
    console.log('\n--- STATUS KONEKSI AKTIF SAAT INI ---');
    console.table(currentStats.rows || currentStats);

    console.log('\n🎉 PENGAMANAN DATABASE BERHASIL DITERAPKAN DENGAN SEMPURNA!');
  } catch (err) {
    console.error('❌ Gagal menerapkan safeguards:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

applyPostgresSafeguards();
