# Deployment Guide - One Chitra

## Persistent File Storage Setup (Dokploy)

Untuk memastikan file upload (PO documents, DO scans, dll) tidak hilang setelah redeploy, ikuti langkah berikut:

### 1. Setup di Dokploy UI

#### A. Tambahkan Environment Variable
Di Dokploy dashboard → Application Settings → Environment Variables:
```
UPLOAD_DIR=/app/uploads
```

#### B. Mount Volume untuk Persistent Storage
Di Dokploy dashboard → Application Settings → Volumes:

**Konfigurasi Volume yang Sudah Ada:**
- **Mount Type**: `BIND`
- **Host Path**: `/mnt/data/one-chitra/uploads`
- **Mount Path (Container)**: `/app/uploads`
- **Mode**: `rw` (read-write)

> **Catatan**: File akan disimpan di `/mnt/data/one-chitra/uploads` di server host dan di-mount ke container di path `/app/uploads`, sehingga tetap aman saat redeploy.

### 2. Verifikasi Setup

Setelah deploy, cek apakah volume sudah terpasang:

```bash
# SSH ke server Dokploy
ssh user@your-server

# Cek volume
docker inspect <container-id> | grep -A 10 Mounts

# Cek isi folder uploads di host
ls -la /mnt/data/one-chitra/uploads/

# Cek dari dalam container
docker exec -it <container-id> ls -la /app/uploads/
```

### 3. Cara Kerja

- **Development**: File disimpan di `public/uploads` (tidak persistent)
- **Production**: File disimpan di `/app/uploads` yang di-mount ke `/mnt/data/one-chitra/uploads`
- Saat redeploy, container baru akan menggunakan volume yang sama
- File tidak akan hilang karena disimpan di host server (`/mnt/data/one-chitra/uploads`), bukan di container

### 4. Akses File via Web

File dapat diakses melalui:
- API Route: `/api/uploads/filename.ext`
- Direct URL (jika static): `/uploads/filename.ext`

Sistem menggunakan custom API route untuk serve file dari volume yang di-mount.

### 5. Backup File Uploads

Untuk backup file uploads secara berkala:

```bash
# Backup manual
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz /mnt/data/one-chitra/uploads/

# Atau setup cron job untuk backup otomatis
0 2 * * * tar -czf /backups/uploads-$(date +\%Y\%m\%d).tar.gz /mnt/data/one-chitra/uploads/
```

### 6. Restore dari Backup

```bash
# Extract backup ke volume
tar -xzf uploads-backup-20240224.tar.gz -C /mnt/data/one-chitra/uploads/
```

## Troubleshooting

### File tidak bisa diupload
- Cek permission folder: `chmod -R 755 /mnt/data/one-chitra/uploads/`
- Cek ownership: `chown -R 1000:1000 /mnt/data/one-chitra/uploads/`
- Cek apakah folder sudah dibuat: `mkdir -p /mnt/data/one-chitra/uploads`

### File hilang setelah redeploy
- Pastikan UPLOAD_DIR sudah diset: `UPLOAD_DIR=/app/uploads`
- Pastikan volume sudah di-mount dengan benar di Dokploy UI
- Cek logs: `docker logs <container-id> | grep Upload`

### Upload stuck/timeout
- Cek ukuran file (max 10MB default)
- Cek disk space: `df -h /mnt/data/`
- Cek logs untuk error detail

### File tidak bisa diakses via web
- Cek API route: `curl http://localhost:3000/api/uploads/test.pdf`
- Cek permission file: `ls -la /mnt/data/one-chitra/uploads/`
- Cek logs Next.js: `docker logs <container-id>`

## Environment Variables Lengkap

```env
# Database
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Auth
# Generate with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
BETTER_AUTH_SECRET=replace_with_64_hex_chars_generated_secret
BETTER_AUTH_URL=https://yourdomain.com
NEXT_PUBLIC_BETTER_AUTH_URL=https://yourdomain.com

# File Upload (PENTING untuk persistent storage)
UPLOAD_DIR=/app/uploads

# Server
PORT=3000
HOSTNAME=0.0.0.0
```

## Migration Database

Setelah deploy, jalankan migration:

```bash
# Via Dokploy console atau SSH
docker exec -it <container-id> npm run db:migrate
```

Atau jalankan script migration manual:
```bash
docker exec -it <container-id> npx tsx scripts/add-movement-columns.ts
```

## Struktur Folder

```
/mnt/data/one-chitra/uploads/     # Host server (persistent)
    ├── abc123.pdf
    ├── def456.jpg
    └── ...

↓ mounted to ↓

/app/uploads/  # Container path mounted to persistent host storage
    ├── abc123.pdf
    ├── def456.jpg
    └── ...
```
