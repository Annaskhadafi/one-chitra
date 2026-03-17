# Quick Setup Guide - Dokploy

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

## Contact

Jika ada masalah, cek:
1. Logs aplikasi: `docker logs <container-id>`
2. Disk space: `df -h /mnt/data/`
3. Permission: `ls -la /mnt/data/one-chitra/uploads/`
