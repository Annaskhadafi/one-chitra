# RFID Web Foundation Document

## Tujuan

Dokumen ini menjelaskan pondasi web untuk RFID yang berjalan berdampingan dengan proses manual. Fokus implementasi dibuat agar:

- RFID dapat dipilotkan hanya di warehouse tertentu
- Dalam warehouse yang sama, hanya kategori/produk tertentu yang wajib RFID
- Warehouse lain tetap full manual
- Modul existing seperti Good Receive, Delivery, Transfer, dan Stock Opname tidak terblokir

## Prinsip Utama

1. Database tetap menjadi source of truth.
2. RFID adalah lapisan tracking tambahan, bukan pengganti total flow manual.
3. Tracking diputuskan per `warehouse + product/category`, bukan hanya per warehouse.
4. Handheld reader diposisikan sebagai alat baca operasional.
5. Desktop encoder diposisikan sebagai alat tulis, reset, rebind, dan verifikasi tag.

## Mode Tracking

Sistem mendukung tiga mode:

- `manual_only`: transaksi tetap manual, RFID tidak diwajibkan
- `optional_rfid`: RFID boleh dipakai, tetapi manual tetap valid
- `required_rfid`: RFID menjadi mode utama, tetapi manual fallback masih bisa jika diizinkan policy

## Fondasi Database Baru

### Konfigurasi & Policy

- `warehouse_rfid_settings`
  - Mengaktifkan RFID per warehouse
  - Menentukan default mode warehouse
  - Menentukan apakah fallback manual diizinkan

- `warehouse_tracking_policies`
  - Menentukan policy per kategori atau per produk
  - Menjadi override di atas default warehouse dan default product

- `warehouse_zones`
  - Mendefinisikan area seperti receiving, outbound, staging, rack, quarantine, desk

### Device & Tag

- `rfid_devices`
  - Menyimpan handheld, desktop encoder, atau fixed reader

- `rfid_tags`
  - Menyimpan EPC/TID/status tag
  - Dapat dipakai untuk tire patch maupun label/tag reusable

- `rfid_tag_write_sessions`
  - Log operasi desktop encoder: register, replace, unbind, reset, verify

### Unit Fisik & Histori

- `inventory_units`
  - Satu baris untuk satu unit fisik barang
  - Sangat penting untuk tire yang per unit punya serial sendiri

- `rfid_tag_bindings`
  - Histori tag sedang atau pernah terpasang di unit mana

- `inventory_unit_events`
  - Audit trail histori unit dari masuk, pindah, keluar, hingga scrap/return

### Scan & Monitoring

- `rfid_scan_sessions`
  - Header sesi scan, misalnya inbound, outbound, transfer, opname

- `rfid_scan_events`
  - Detail pembacaan tag per sesi

- `rfid_exceptions`
  - Menyimpan mismatch, unknown tag, duplicate read, wrong warehouse, manual override, dan kasus lain

## Perubahan Master Product

Tabel `products` ditambah:

- `default_tracking_mode`
- `serial_required`
- `rfid_capable`
- `allow_tag_reuse`

Dengan ini satu material dapat tetap manual di sebagian warehouse, tapi menjadi RFID/hybrid di warehouse pilot melalui policy override.

## Resolusi Policy

Urutan penentuan mode tracking:

1. Jika warehouse RFID belum aktif, maka hasilnya `manual_only`
2. Policy per produk di warehouse
3. Policy per kategori di warehouse
4. Default tracking di master product
5. Default tracking di warehouse
6. Fallback sistem `manual_only`

Helper yang menangani ini ada di `lib/rfid-tracking.ts`.

## Integrasi Bertahap ke Modul Existing

### Good Receive

- Flow manual tetap jalan
- Tire atau item pilot dapat dibuat sebagai `awaiting_tagging` atau langsung dibind ke tag
- Transaksi ke `stock_levels` dan `stock_movements` tetap dipertahankan

### Delivery

- Flow existing tetap jalan
- Item tertentu nanti dapat divalidasi lewat RFID sebelum outbound
- Manual override harus dicatat ke exception log

### Stock Transfer

- Transfer antar warehouse tetap bisa manual
- Jika asal RFID dan tujuan manual, histori unit tetap tersimpan di backend

### Stock Opname

- Warehouse pilot dapat memakai RFID/hybrid
- Warehouse non-pilot tetap manual

## Action Server Yang Disiapkan

Action baru di `app/actions/rfid.ts` menyediakan:

- setup data warehouse + policy
- save setting warehouse RFID
- save/delete tracking policy
- preview keputusan tracking per produk
- ringkasan monitoring RFID

## Status Implementasi Saat Ini

Pondasi web yang sudah disiapkan:

- schema database RFID foundation
- tambahan field tracking di master product
- helper hybrid policy resolution
- action server untuk setup dan monitoring awal

Tahap berikutnya yang disarankan:

1. Hubungkan helper tracking ke form Good Receive, Delivery, Transfer, dan Stock Opname
2. Tambahkan halaman dashboard `RFID Monitoring`
3. Tambahkan halaman `RFID Setup` untuk warehouse pilot dan policy per kategori/produk
4. Tambahkan flow desktop encoder untuk register/reset/replace tag
5. Baru lanjutkan integrasi ke branch mobile
