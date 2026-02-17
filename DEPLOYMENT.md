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

### Static assets tidak muncul (CSS/JS 404)
Pastikan `nixpacks.toml` sudah include step copy static:
```toml
"cp -r .next/static .next/standalone/.next/static",
"cp -r public .next/standalone/public"
```

### Database connection timeout
- Cek apakah `DATABASE_URL` benar
- Jika pakai NeonDB, pastikan `?sslmode=require` ada di URL
- Cek firewall/security group server
