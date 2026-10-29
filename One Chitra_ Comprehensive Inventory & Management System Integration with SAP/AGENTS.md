# Standar Upload File, Penyimpanan S3 & Resolusi URL (MANDATORI - PALING ATAS)

## 📁 Aturan Wajib Upload & Penayangan Berkas (File / Dokumen / Foto)

Untuk memastikan seluruh berkas yang diunggah dapat diakses secara persisten di semua environment (Local dev, Dokploy production, mobile webview, PDF preview) tanpa mengalami **403 Forbidden** atau **Token Expired (1 Jam)**:

### 1. Endpoint Penyajian & Proxy Terpusat (`/api/uploads/[...path]`)
* Seluruh file dan gambar **WAJIB** disajikan melalui proxy terpusat: `GET /api/uploads/[...path]`.
* **DILARANG KERAS** menyimpan atau me-render URL langsung S3 CloudHost (misal `https://is3.cloudhost.id/onechitra/...`) di komponen UI maupun database, karena bucket S3 berstatus **PRIVATE** dan akan menghasilkan **403 Forbidden**.
* **DILARANG KERAS** menyimpan URL bertanda tangan presigned S3 (`?X-Amz-...`) ke dalam database. Token presigned S3 hanya berlaku 3600 detik (1 jam) dan akan rusak setelahnya.
* Semua aksi upload (`uploadFile`, `uploadAnyFileToS3`, `uploadProfilePhotoToS3`, `uploadBufferToS3`, dll.) harus selalu mengembalikan link proxy persisten: `/api/uploads/${key}` untuk nilai `url` maupun `readableUrl`.

### 2. URL Resolusi Dinamis (`resolveUploadUrl` & Flexible `BETTER_AUTH_URL`)
* Setiap kali me-render foto, gambar, avatar, tanda tangan, atau lampiran dokumen (PDF/Office) di tag `<img src={...}>`, `<a href={...}>`, modal preview, lightbox, dialog, atau PDF generation:
  **WAJIB** membungkus URL dengan `resolveUploadUrl(rawUrl)`.
* `resolveUploadUrl` menangani pemetaan otomatis:
  * URL S3 CloudHost langsung -> diubah menjadi `/api/uploads/${key}`
  * Query string kedaluwarsa (`?X-Amz-...`) -> dibersihkan
  * Domain host (localhost, 127.0.0.1, hero.chitraparatama.com) -> disesuaikan secara fleksibel membaca `BETTER_AUTH_URL` / `NEXT_PUBLIC_BETTER_AUTH_URL` atau `window.location.origin`. Jika di localhost maka pakai localhost, jika di hero.chitraparatama.com maka mengikuti domain host aktif.
* Untuk kebutuhan absolute URL (misal WhatsApp notification, email link, webhook, atau print server-side): gunakan `resolveUploadUrl(rawUrl, { absolute: true })`.

### 3. Registrasi Prefix di Proxy `/api/uploads`
* Setiap kali membuat modul baru dengan folder/prefix upload baru, prefix tersebut **WAJIB** didaftarkan ke:
  1. `ALLOWED_UPLOAD_PREFIXES` di `app/api/uploads/[...path]/route.ts`
  2. `isPublicPrefix` di `app/api/uploads/[...path]/route.ts` (jika dapat dilihat oleh guest, mobile, atau subresources tanpa session cookie)
  3. `candidateS3Keys` di `app/api/uploads/[...path]/route.ts`
  4. `extractS3ObjectKeyFromUrl` di `lib/resolve-upload-url.ts`
  5. `getObjectKeyFromUrl` & regex di `lib/s3-storage.ts`
  6. `lib/client-upload-url.ts`
* Daftar prefix standar sistem:
  `upload`, `uploads`, `activity-photos`, `attendance-photos`, `profile-photos`, `curhat`, `curhat-attachments`, `mcu-wellness-results`, `mcu-referral-letters`, `mcu-results`, `offering-letters`, `sop-win-requests`, `sop-win`, `lms-materials`, `lms-covers`, `chitralearning`, `emergency-reports`, `safety`, `face-attendance`, `face-attendance-v2`, `contract-review-attachment`, `public-career-cv`.

### 4. Penyimpanan Lokal Dokploy (Fallback Persistence)
* Direktori `public/uploads` di production (Dokploy) dipetakan ke Persistent Bind Mount di `/mnt/data/one-chitra/uploads`.
* Gunakan centralized `uploadFile` action di `app/actions/upload.ts`. Jangan gunakan `fs` langsung di komponen klien.

---

# Claude MCPs Quick Guide

This project is configured for Claude development but no specific MCP servers are currently selected.

## What are MCP Servers?
Model Context Protocols (MCPs) enhance Claude's capabilities by providing access to external tools and services.

## Getting Started
Add MCP servers to enhance your development workflow with additional capabilities.
