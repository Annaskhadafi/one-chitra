import 'dotenv/config';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function backup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL tidak ditemukan di file .env');
    process.exit(1);
  }

  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const fileName = `one_chitra_backup_${timestamp}.sql`;
  const outputPath = path.join(backupDir, fileName);

  console.log(`📦 Memulai backup database PostgreSQL...`);

  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log(`🔌 Terhubung ke database PostgreSQL.`);

    // Get all public tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`📋 Ditemukan ${tables.length} tabel.`);

    // Initialize file
    fs.writeFileSync(outputPath, `-- One Chitra Database Backup\n-- Created at: ${now.toISOString()}\n-- Database: PostgreSQL\n\nSET statement_timeout = 0;\nSET lock_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\n\n`, 'utf-8');

    // Dump Tables & Data
    let count = 0;
    for (const table of tables) {
      count++;
      console.log(`[${count}/${tables.length}] Backing up: ${table}...`);

      let chunks: string[] = [];

      // Get table DDL (columns info)
      const colsRes = await client.query(`
        SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);

      chunks.push(`-- Table structure for table "${table}"\n`);
      chunks.push(`DROP TABLE IF EXISTS "${table}" CASCADE;\n`);

      // Extract sequences referenced in default values
      for (const col of colsRes.rows) {
        if (col.column_default && typeof col.column_default === 'string' && col.column_default.includes('nextval(')) {
          const match = col.column_default.match(/nextval\('([^']+)'/);
          if (match && match[1]) {
            const rawSeqName = match[1].replace(/"/g, '').split('.').pop() || match[1];
            chunks.push(`CREATE SEQUENCE IF NOT EXISTS "${rawSeqName}";\n`);
          }
        }
      }
      
      const colDefs = colsRes.rows.map(col => {
        let typeDef = col.udt_name;
        if (col.data_type === 'ARRAY' || typeDef.startsWith('_')) {
          const baseType = typeDef.replace(/^_/, '');
          let mappedBase = baseType;
          if (baseType === 'varchar' || baseType === 'bpchar') mappedBase = 'text';
          if (baseType === 'int4') mappedBase = 'integer';
          if (baseType === 'int8') mappedBase = 'bigint';
          if (baseType === 'bool') mappedBase = 'boolean';
          if (baseType === 'float8') mappedBase = 'double precision';
          typeDef = `${mappedBase}[]`;
        } else {
          if (typeDef === 'varchar' || typeDef === 'bpchar') typeDef = 'text';
          if (typeDef === 'int4') typeDef = 'integer';
          if (typeDef === 'int8') typeDef = 'bigint';
          if (typeDef === 'bool') typeDef = 'boolean';
          if (typeDef === 'float8') typeDef = 'double precision';
          if (typeDef === 'timestamptz') typeDef = 'timestamp with time zone';
          if (typeDef === 'timestamp') typeDef = 'timestamp without time zone';
        }

        let line = `  "${col.column_name}" ${typeDef}`;
        if (col.is_nullable === 'NO') {
          line += ` NOT NULL`;
        }
        if (col.column_default !== null) {
          line += ` DEFAULT ${col.column_default}`;
        }
        return line;
      });

      chunks.push(`CREATE TABLE "${table}" (\n` + colDefs.join(',\n') + `\n);\n\n`);
      fs.appendFileSync(outputPath, chunks.join(''), 'utf-8');
      chunks = [];

      // Get table data
      const dataRes = await client.query(`SELECT * FROM "${table}"`);
      if (dataRes.rows.length > 0) {
        chunks.push(`-- Data for table "${table}" (${dataRes.rows.length} rows)\n`);
        const colNames = colsRes.rows.map(c => `"${c.column_name}"`).join(', ');

        for (const row of dataRes.rows) {
          const values = colsRes.rows.map(c => {
            const val = row[c.column_name];
            if (val === null || val === undefined) return 'NULL';

            // JSON / JSONB columns
            if (c.udt_name === 'jsonb' || c.udt_name === 'json') {
              return `'${JSON.stringify(val).replace(/'/g, "''")}'::${c.udt_name}`;
            }

            // PostgreSQL Array columns
            if (c.data_type === 'ARRAY' || c.udt_name.startsWith('_')) {
              if (!Array.isArray(val) || val.length === 0) return "'{}'";
              const items = val.map(item => {
                if (item === null || item === undefined) return 'NULL';
                if (typeof item === 'number' || typeof item === 'boolean') return item.toString();
                return `'${String(item).replace(/'/g, "''")}'`;
              }).join(', ');
              return `ARRAY[${items}]`;
            }

            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (typeof val === 'number') return val.toString();
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return `'${String(val).replace(/'/g, "''")}'`;
          }).join(', ');

          chunks.push(`INSERT INTO "${table}" (${colNames}) VALUES (${values});\n`);

          if (chunks.length >= 1000) {
            fs.appendFileSync(outputPath, chunks.join(''), 'utf-8');
            chunks = [];
          }
        }
        chunks.push(`\n`);
      }

      if (chunks.length > 0) {
        fs.appendFileSync(outputPath, chunks.join(''), 'utf-8');
        chunks = [];
      }
    }

    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`✅ Backup BERHASIL dibuat!`);
    console.log(`📄 File: ${outputPath}`);
    console.log(`📊 Ukuran File: ${sizeMB} MB (${stats.size} bytes)`);

  } catch (error) {
    console.error('❌ Gagal melakukan backup database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

backup().catch(err => {
  console.error("❌ Fatal Backup Error:", err);
  process.exit(1);
});
