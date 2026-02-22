# 🚀 Deployment Guide — Dokploy (Nixpacks)

Panduan deploy One Chitra di Dokploy menggunakan Nixpacks.

## Prerequisites

- Server dengan [Dokploy](https://dokploy.com) terinstall
- Database PostgreSQL (NeonDB / Supabase / self-hosted)
- Repository Git yang bisa diakses oleh Dokploy

---

## Langkah-langkah Deploy

### 1. Buat Application di Dokploy

1. Login ke Dokploy dashboard
2. Klik **Create Project** → beri nama (misal: `one-chitra`)
3. Di dalam project, klik **Create Service** → pilih **Application**
4. Pilih **Provider**: GitHub / Git
5. Hubungkan repository One Chitra
6. Set **Branch**: `main` (atau branch production kamu)

### 2. Konfigurasi Build

1. Di tab **General**:
   - **Build Type**: Nixpacks ✅
   - Nixpacks akan otomatis mendeteksi `nixpacks.toml`
2. Port akan otomatis di-set ke `3000`

### 3. Set Environment Variables

Di tab **Environment**, tambahkan variabel berikut:

| Variable | Contoh Value | Keterangan |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` | Connection string NeonDB |
| `BETTER_AUTH_SECRET` | `random-secret-key-min-32-chars` | Secret untuk auth session |
| `BETTER_AUTH_URL` | `https://yourdomain.com` | URL production |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | `https://yourdomain.com` | URL public (same as above) |

> **⚠️ PENTING**: `BETTER_AUTH_SECRET` harus random & panjang minimal 32 karakter. Generate dengan:
> ```bash
> openssl rand -base64 32
> ```

### 4. Set Domain

1. Di tab **Domains**, tambahkan domain kamu
2. Dokploy akan otomatis generate SSL via Let's Encrypt
3. Pastikan DNS A record sudah point ke IP server

### 5. Deploy

1. Klik **Deploy** di dashboard
2. Nixpacks akan:
   - Install dependencies (`npm ci`)
   - Generate Drizzle schema (`npm run db:generate`)
   - Build Next.js (`npm run build`)
   - Copy static assets
   - Start server (`node .next/standalone/server.js`)

### 6. Database Migration

Setelah deploy pertama, jalankan migration via **Dokploy Terminal** atau SSH:

```bash
# Masuk ke container
npx drizzle-kit push
```

Atau set migration sebagai bagian dari build di `nixpacks.toml` (sudah include `db:generate`).

---

## Healthcheck

Aplikasi sudah memiliki endpoint healthcheck:

```
GET /api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-17T14:30:00.000Z",
  "uptime": 12345.67
}
```

Konfigurasi healthcheck di Dokploy (opsional):
- **Path**: `/api/health`
- **Interval**: 30 detik
- **Timeout**: 10 detik

---

## File Penting

| File | Fungsi |
|---|---|
| `nixpacks.toml` | Konfigurasi build Nixpacks |
| `next.config.ts` | Next.js standalone output |
| `.env.example` | Template environment variables |
| `app/api/health/route.ts` | Healthcheck endpoint |

---

## Troubleshooting

### Build gagal: "Cannot find module '@neondatabase/serverless'"
Pastikan `DATABASE_URL` sudah di-set sebagai environment variable di Dokploy **sebelum** build.

### Error: "BETTER_AUTH_URL must be set"
Set `BETTER_AUTH_URL` dan `NEXT_PUBLIC_BETTER_AUTH_URL` di environment variables.

### File upload hilang setelah redeploy ("File not found")

**Root Cause**: File upload disimpan di dalam container filesystem yang bersifat **ephemeral** (sementara). Setiap kali `git push` memicu redeploy, container lama dihancurkan bersama semua file yang sudah di-upload.

**Fix untuk Dokploy (Nixpacks)**:

1. Di Dokploy dashboard, buka service aplikasi kamu
2. Pergi ke tab **Mounts** (atau **Storage / Volumes**)
3. Tambahkan mount baru:
   - **Host Path**: `/mnt/data/one-chitra/uploads` (atau path VPS volume kamu)
   - **Container Path**: `/app/.next/standalone/public/uploads` ⚠️ PENTING: path ini, bukan `/app/public/uploads`
   - Type: **Bind Mount**
4. Pastikan folder di VPS sudah ada dan ada permission write:
   ```bash
   mkdir -p /mnt/data/one-chitra/uploads
   chmod 777 /mnt/data/one-chitra/uploads
   ```
5. Klik **Save** dan **Redeploy**

> **Mengapa `/app/.next/standalone/public/uploads`?**  
> Nixpacks menjalankan Next.js dalam **standalone mode**. Server berjalan dari `/app/.next/standalone/server.js`, sehingga `process.cwd()` di runtime mengembalikan `/app/.next/standalone` — bukan `/app`. Akibatnya semua file upload ditulis ke `/app/.next/standalone/public/uploads`.

> **Penting**: Setelah mount dikonfigurasi di Dokploy, file upload akan ditulis ke VPS path tersebut dan **tidak akan hilang** saat redeploy karena path di luar container.

**Verifikasi**: Setelah konfigurasi mount, test upload file → redeploy → cek apakah file masih ada.



### Database connection timeout
- Cek apakah `DATABASE_URL` benar
- Jika pakai NeonDB, pastikan `?sslmode=require` ada di URL
- Cek firewall/security group server

---

## 📊 Database Management & Viewing Data

Ada beberapa cara untuk melihat data di PostgreSQL Dokploy:

### 1. Drizzle Studio (Paling Direkomendasikan)
Kamu bisa menjalankan GUI database di PC lokal kamu tapi tersambung ke database Dokploy:
1. Di file `.env` lokal kamu, ganti sementara `DATABASE_URL` ke URL **External** PostgreSQL Dokploy (Gunakan IP Server & External Port).
2. Jalankan: `npm run db:studio`
3. Buka browser di `localhost:4983`. Kamu bisa edit data seperti Excel.

### 2. External GUI (DBeaver / TablePlus)
Jika kamu sudah expose **External Port** (misal: 5432) di tab **External Credentials** Dokploy Database:
1. Pakai aplikasi **DBeaver** atau **TablePlus** di Windows.
2. Connect menggunakan `IP Server`, Port `5432`, User `satuchitra`, and Password `Wusthochq2018-`.

### 3. CLI (Dokploy Terminal)
Untuk query cepat lewat terminal database Dokploy (seperti di screenshot kamu):
- Tabel list: `\dt`
- Lihat data: `SELECT * FROM "user" LIMIT 10;` (Gunakan tanda kutip untuk nama tabel yang case-sensitive).
- Keluar dari psql: `\q`
