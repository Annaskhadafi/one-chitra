# Quick Setup Guide - Dokploy

## Deploy Dengan Ollama di VPS

File yang bisa langsung dipakai:

- `docker-compose.dokploy.yml`
- `.env.dokploy.example`

Langkah ringkas:

1. Copy `.env.dokploy.example` menjadi env di Dokploy.
2. Pastikan volume host ini tersedia:
   - `/mnt/data/one-chitra/uploads`
   - `/mnt/data/one-chitra/ollama`
3. Deploy compose `docker-compose.dokploy.yml`.
4. Tunggu service `ollama` hidup lalu `ollama-init` menarik model awal.
5. Setelah model selesai di-pull, OCR app akan mengakses Ollama lewat `http://ollama:11434`.

Catatan penting:

- Model default saat ini `qwen2.5vl:7b` agar lebih realistis untuk VPS tanpa GPU besar.
- Jika VPS kecil, model ini tetap bisa berat. Pilih model vision yang lebih ringan bila perlu.
- `ollama-init` hanya untuk pull model awal. Setelah selesai, container ini akan berhenti sendiri.
- Jika ingin full private OCR tanpa Mistral, kosongkan `MISTRAL_API_KEY`.
- Jika ingin hybrid, biarkan `MISTRAL_API_KEY` tetap terisi agar app masih bisa fallback ke Mistral.

## Current Configuration

### Volume Mount (Already Configured)
```
Mount Type: BIND
Host Path: /mnt/data/one-chitra/uploads
Mount Path: /app/uploads
```

### Environment Variable (Add This)
Di Dokploy UI → Environment Variables, tambahkan:
```
UPLOAD_DIR=/app/uploads
```

## Checklist Deployment

- [x] Volume sudah di-mount di Dokploy
- [ ] Environment variable `UPLOAD_DIR` sudah ditambahkan
- [ ] Redeploy aplikasi setelah menambahkan env variable
- [ ] Test upload file
- [ ] Verifikasi file tidak hilang setelah redeploy

## Test Upload

1. Login ke aplikasi
2. Buat Sales Order baru
3. Upload PO document
4. Cek file di server: `ls -la /mnt/data/one-chitra/uploads/`
5. Redeploy aplikasi
6. Cek file masih ada: `ls -la /mnt/data/one-chitra/uploads/`
7. Akses file via browser: `https://yourdomain.com/api/uploads/filename.ext`

## Troubleshooting Quick Fix

### Upload gagal
```bash
# SSH ke server
ssh user@your-server

# Buat folder jika belum ada
mkdir -p /mnt/data/one-chitra/uploads

# Set permission
chmod -R 755 /mnt/data/one-chitra/uploads
chown -R 1000:1000 /mnt/data/one-chitra/uploads
```

### Cek logs
```bash
# Cek container ID
docker ps | grep one-chitra

# Lihat logs
docker logs <container-id> | grep -i upload

# Atau follow logs real-time
docker logs -f <container-id>
```

### Verifikasi mount
```bash
# Cek apakah volume ter-mount
docker inspect <container-id> | grep -A 10 Mounts

# Cek dari dalam container
docker exec -it <container-id> ls -la /app/uploads/
```

## Migration Database

Setelah deploy pertama kali atau ada perubahan schema:

```bash
# Jalankan migration
docker exec -it <container-id> npx tsx scripts/add-movement-columns.ts
```

## Backup Otomatis (Optional)

Setup cron job di server untuk backup harian:

```bash
# Edit crontab
crontab -e

# Tambahkan baris ini (backup setiap jam 2 pagi)
0 2 * * * tar -czf /backups/one-chitra-uploads-$(date +\%Y\%m\%d).tar.gz /mnt/data/one-chitra/uploads/
```

## Revenue Report Cron

Jika ingin menjalankan automation revenue report dari scheduler eksternal, gunakan endpoint:

```bash
https://yourdomain.com/api/cron/revenue-report
```

Header yang wajib dikirim:

```bash
Authorization: Bearer <CRON_SECRET>
```

Catatan penting:

- Image runtime sekarang menyertakan `curl`, jadi command scheduler lama seperti `docker exec <container-id> sh -c 'curl -s -H "Authorization: Bearer ..."'` bisa jalan setelah redeploy.
- Jika ingin menghindari dependensi `curl`, pakai command ini di scheduler:

```bash
docker exec <container-id> node -e "fetch('https://yourdomain.com/api/cron/revenue-report',{headers:{Authorization:'Bearer ' + process.env.CRON_SECRET}}).then(async(r)=>{const body=await r.text();console.log(body);if(!r.ok)process.exit(1)}).catch((err)=>{console.error(err);process.exit(1)})"
```

- Pastikan environment variable `CRON_SECRET` tersedia di container aplikasi.
- Waktu schedule di UI revenue report disimpan dalam WIB (UTC+7).

## Contact

Jika ada masalah, cek:
1. Logs aplikasi: `docker logs <container-id>`
2. Disk space: `df -h /mnt/data/`
3. Permission: `ls -la /mnt/data/one-chitra/uploads/`
