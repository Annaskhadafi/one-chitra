## RFID Database Rollout

Gunakan script berikut untuk menyinkronkan pondasi RFID ke database tanpa menunggu migration Drizzle penuh:

```bash
npm run db:rfid-foundation
```

Script ini bersifat idempoten dan aman dijalankan berulang kali. Saat ini cakupannya:

- menambahkan kolom tracking RFID di `products`
- membuat enum PostgreSQL untuk mode tracking dan status RFID
- membuat tabel pondasi:
  - `warehouse_rfid_settings`
  - `warehouse_tracking_policies`
  - `warehouse_zones`
  - `rfid_devices`
  - `rfid_tags`
  - `inventory_units`
  - `rfid_tag_bindings`
  - `inventory_unit_events`
  - `rfid_scan_sessions`
  - `rfid_scan_events`
  - `rfid_exceptions`
  - `rfid_tag_write_sessions`

Kenapa pakai script manual dulu:

- repo ini masih punya schema drift lama di luar RFID
- `drizzle-kit generate` ikut menarik perubahan yang tidak berhubungan
- kita perlu rollout RFID bertahap tanpa mencampur migration lama yang belum dibereskan

Setelah schema lama repo sudah bersih, script ini bisa digantikan oleh migration Drizzle resmi.
