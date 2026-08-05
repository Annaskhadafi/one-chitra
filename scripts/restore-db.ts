import 'dotenv/config';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function findPsql(): string {
  const possiblePaths = [
    'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\16\\pgAdmin 4\\runtime\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\17\\pgAdmin 4\\runtime\\psql.exe',
    'psql'
  ];

  for (const p of possiblePaths) {
    if (p === 'psql') return 'psql';
    if (fs.existsSync(p)) return `"${p}"`;
  }
  return 'psql';
}

function findPgRestore(): string {
  const possiblePaths = [
    'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_restore.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_restore.exe',
    'C:\\Program Files\\PostgreSQL\\16\\pgAdmin 4\\runtime\\pg_restore.exe',
    'C:\\Program Files\\PostgreSQL\\17\\pgAdmin 4\\runtime\\pg_restore.exe',
    'pg_restore'
  ];

  for (const p of possiblePaths) {
    if (p === 'pg_restore') return 'pg_restore';
    if (fs.existsSync(p)) return `"${p}"`;
  }
  return 'pg_restore';
}

async function restore() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL tidak ditemukan di file .env');
    process.exit(1);
  }

  const backupDir = path.join(process.cwd(), 'backups');
  let backupFile = process.argv[2];

  if (!backupFile) {
    if (!fs.existsSync(backupDir)) {
      console.error('❌ Folder backups tidak ditemukan.');
      process.exit(1);
    }

    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => {
        return fs.statSync(path.join(backupDir, b)).mtimeMs - fs.statSync(path.join(backupDir, a)).mtimeMs;
      });

    if (files.length === 0) {
      console.error('❌ Tidak ditemukan file .sql di folder backups.');
      process.exit(1);
    }

    backupFile = path.join(backupDir, files[0]);
    console.log(`ℹ️ Menggunakan file backup terbaru: ${files[0]}`);
  } else {
    if (!path.isAbsolute(backupFile)) {
      backupFile = path.join(process.cwd(), backupFile);
    }
  }

  if (!fs.existsSync(backupFile)) {
    console.error(`❌ File backup tidak ditemukan: ${backupFile}`);
    process.exit(1);
  }

  const isCustomFormat = (() => {
    try {
      const buffer = Buffer.alloc(5);
      const fd = fs.openSync(backupFile, 'r');
      fs.readSync(fd, buffer, 0, 5, 0);
      fs.closeSync(fd);
      return buffer.toString('utf8') === 'PGDMP';
    } catch {
      return false;
    }
  })();

  try {
    let env = { ...process.env };
    try {
      const url = new URL(dbUrl);
      if (url.password) {
        env['PGPASSWORD'] = decodeURIComponent(url.password);
      }
    } catch (e) {
      // ignore URL parsing error
    }

    if (isCustomFormat) {
      const pgRestoreCmd = findPgRestore();
      console.log(`🔍 Format backup: Custom Dump (PGDMP). Menggunakan pg_restore dari: ${pgRestoreCmd}`);
      console.log(`⏳ Memulai restore database dari: ${backupFile}`);
      const command = `${pgRestoreCmd} --dbname="${dbUrl}" --no-owner --no-acl "${backupFile}"`;
      execSync(command, { 
        stdio: 'inherit', 
        env,
        maxBuffer: 1024 * 1024 * 512,
      });
    } else {
      const psqlCmd = findPsql();
      console.log(`🔍 Format backup: Plain SQL. Menggunakan psql dari: ${psqlCmd}`);
      console.log(`⏳ Memulai restore database dari: ${backupFile}`);
      const command = `${psqlCmd} "${dbUrl}" --file="${backupFile}" --set ON_ERROR_STOP=off`;
      execSync(command, { 
        stdio: 'inherit', 
        env: {
          ...env,
          PGOPTIONS: '-c tcp_keepalives_idle=60 -c tcp_keepalives_interval=10 -c tcp_keepalives_count=10 -c statement_timeout=0 -c lock_timeout=0',
        },
        maxBuffer: 1024 * 1024 * 512, // 512MB buffer
      });
    }
    console.log(`✅ Restore BERHASIL diselesaikan dari ${backupFile}!`);
  } catch (error) {
    console.error('❌ Gagal melakukan restore database:', error);
    process.exit(1);
  }
}

restore().catch(err => {
  console.error("❌ Fatal Restore Error:", err);
  process.exit(1);
});
