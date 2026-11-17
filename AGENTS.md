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

# Sinkronisasi Git Wajib Sebelum Bekerja, Commit, Push, dan Merge

* Pada awal **setiap sesi**, sebelum mengubah file, periksa `git status --short --branch` dan upstream branch, lalu jalankan `git pull --ff-only` dari remote/upstream branch aktif.
* **Ulangi `git pull --ff-only` tepat sebelum setiap commit, push, dan merge.** Sebelum merge, sinkronkan branch sumber dan tujuan dengan upstream masing-masing. Jangan menganggap pull di awal sesi masih cukup.
* Jika upstream belum tersedia, tentukan remote dan branch yang benar dari konfigurasi repository; jangan menebak atau otomatis memakai `main`.
* Jika pull gagal karena koneksi, perubahan lokal, branch divergen, atau konflik, hentikan aksi commit/push/merge sampai masalah selesai. Pertahankan pekerjaan pengguna; jangan memakai reset destruktif, menghapus file, melakukan stash otomatis, atau force push.
* Setelah integrasi perubahan remote, periksa diff dan jalankan ulang pengujian yang relevan bila kode yang diuji berubah. Pastikan hanya file terkait tugas yang masuk commit.

# Pengujian E2E dan Screenshot Wajib

* Setiap perubahan wajib diverifikasi dengan tes E2E pada browser nyata untuk alur yang terdampak, termasuk login dan pemeriksaan hasil akhir. Untuk perubahan instruksi/dokumentasi saja, jalankan smoke test login dan akses dashboard sebagai bukti akses pengujian.
* **Default E2E adalah `http://localhost:3000`**, dari dev server repository dan worktree yang sedang diubah. Pastikan port 3000 menjalankan ONE-CHITRA yang benar, bukan aplikasi lain. Jangan otomatis pindah port jika port 3000 sedang dipakai; laporkan benturannya. Port lain hanya digunakan atas instruksi pengguna. Runner harus menolak host nonlokal (loopback `127.0.0.1`/`[::1]` diperbolehkan).
* **Jangan mengganti target ke domain production ketika E2E lokal gagal.** Kode yang belum di-push/deploy belum tersedia di production. Laporkan hambatan lokal dan status belum terverifikasi; tes production hanya boleh menjadi pemeriksaan setelah deployment yang diminta secara terpisah, bukan bukti perubahan lokal.
* Gunakan akun pengujian ONE-CHITRA yang tersimpan di **`.env.e2e.local`** melalui `E2E_EMAIL`, `E2E_PASSWORD`, dan `E2E_BASE_URL`. Muat file ini secara eksplisit pada runner (misalnya `dotenv.config({ path: '.env.e2e.local', quiet: true })`); jangan mengandalkan Next.js memuatnya otomatis.
* Kredensial wajib tetap di env lokal yang diabaikan Git. Jangan menulis nilainya ke AGENTS.md, source, test, log, laporan, screenshot, atau variabel `NEXT_PUBLIC_*`. Jangan commit env, cookie, token, maupun browser storage state.
* Simpan screenshot asli hasil tes di `output/playwright/`, dengan nama fitur dan tanggal yang jelas. Ambil bukti halaman/hasil setelah aksi berhasil, tanpa menampilkan password atau token; jangan memakai mockup sebagai bukti.
* Sertakan perintah, target URL, hasil assertion (lulus/gagal), dan tautan screenshot pada laporan akhir. Jika E2E terhambat, sebutkan penyebab dan langkah yang belum terverifikasi; jangan mengklaim lulus.
* **Setelah tes lulus, bukti screenshot tertanam di PPT bulanan, dan PPT terverifikasi, wajib bersihkan hasil tes sementara milik tugas ini dari repository**: screenshot, log, report, trace/video, browser storage state, runner sementara, dan salinan cadangan PPT. Simpan screenshot yang masih diperlukan untuk laporan di lokasi artefak di luar folder kode. Jangan menghapus source test permanen, env lokal, bukti yang belum tersimpan, atau hasil pekerjaan lain; periksa kepemilikan dan path setiap file sebelum menghapusnya. Jangan commit hasil tes sementara.

# Aturan Wajib Pembaruan Slide Presentasi Bulanan

* Setelah E2E selesai dan screenshot berhasil diambil, **wajib jalankan skrip otomasi** untuk mencatat progress pekerjaan, perbaikan bug, atau fitur beserta bukti di `D:\[01] PROJECT\HERO\Monthly`.
* Gunakan skrip terpusat yang sudah tersedia di repo HERO. Dari repo ONE-CHITRA, jalankan dengan path absolut berikut (ganti judul, deskripsi, screenshot, bulan, dan tahun sesuai pekerjaan):

```powershell
python "D:\[01] PROJECT\HERO\scripts\update-monthly-presentation.py" `
  --title "Nama Fitur atau Perbaikan" `
  --description "Penjelasan singkat perubahan, tujuan, serta hasil E2E yang sebenarnya" `
  --screenshots "output/playwright/fitur-YYYY-MM-DD.png" `
  --system "ONE-CHITRA" `
  --month 11 --year 2026
```

* `--month` dan `--year` wajib mengikuti tanggal pekerjaan dalam zona **Asia/Makassar**; angka di atas hanya contoh November 2026, bukan nilai tetap. Gunakan `--system "HERO"` untuk pekerjaan HERO dan `"ONE-CHITRA"` untuk pekerjaan ONE-CHITRA.
* Perbarui `MONTHLY <BULAN> <TAHUN> SDS.pptx` sesuai bulan tersebut. Pertahankan isi dan desain yang sudah ada; tambahkan ringkasan dan slide bukti sebelum bagian planning. Jangan menimpa presentasi bulan lain atau menambahkan klaim keberhasilan ketika tes gagal.
* Verifikasi file hasil dapat dibuka, teks terbaca, dan screenshot tertanam dengan proporsi yang benar. Sertakan tautan file PPTX dan nomor slide pada laporan akhir. Jika skrip gagal atau PPTX terkunci, laporkan bahwa pembaruan presentasi belum selesai.

---

# Codex Task Management Guide

## Documentation Available

📚 **Project Documentation**: Check the documentation files in this directory for project-specific setup instructions and guides.
**Project Tasks**: Check the tasks directory in documentation/tasks for the list of tasks to be completed. Use the CLI commands below to interact with them.

## MANDATORY Task Management Workflow

🚨 **YOU MUST FOLLOW THIS EXACT WORKFLOW - NO EXCEPTIONS** 🚨

### **STEP 1: DISCOVER TASKS (MANDATORY)**
You MUST start by running this command to see all available tasks:
```bash
task-manager list-tasks
```

### **STEP 2: START EACH TASK (MANDATORY)**
Before working on any task, you MUST mark it as started:
```bash
task-manager start-task <task_id>
```

### **STEP 3: COMPLETE OR CANCEL EACH TASK (MANDATORY)**
After finishing implementation, you MUST mark the task as completed, or cancel if you cannot complete it:
```bash
task-manager complete-task <task_id> "Brief description of what was implemented"
# or
task-manager cancel-task <task_id> "Reason for cancellation"
```

## Task Files Location

📁 **Task Data**: Your tasks are organized in the `documentation/tasks/` directory:
- Task JSON files contain complete task information
- Use ONLY the `task-manager` commands listed above
- Follow the mandatory workflow sequence for each task

## MANDATORY Task Workflow Sequence

🔄 **For EACH individual task, you MUST follow this sequence:**

1. 📋 **DISCOVER**: `task-manager list-tasks` (first time only)
2. 🚀 **START**: `task-manager start-task <task_id>` (mark as in progress)
3. 💻 **IMPLEMENT**: Do the actual coding/implementation work
4. ✅ **COMPLETE**: `task-manager complete-task <task_id> "What was done"` (or cancel with `task-manager cancel-task <task_id> "Reason"`)
5. 🔁 **REPEAT**: Go to next task (start from step 2)

## Task Status Options

- `pending` - Ready to work on
- `in_progress` - Currently being worked on  
- `completed` - Successfully finished
- `blocked` - Cannot proceed (waiting for dependencies)
- `cancelled` - No longer needed

## CRITICAL WORKFLOW RULES

❌ **NEVER skip** the `task-manager start-task` command
❌ **NEVER skip** the `task-manager complete-task` command  (use `task-manager cancel-task` if a task is not planned, not required, or you must stop it)
❌ **NEVER work on multiple tasks simultaneously**
✅ **ALWAYS complete one task fully before starting the next**
✅ **ALWAYS provide completion details in the complete command**
✅ **ALWAYS follow the exact 3-step sequence: list → start → complete (or cancel if not required)**

## graphify

This project has a local graphify knowledge graph in `graphify-out/`.

Token-saving rules:
- For architecture, dependency, ownership, cross-module, or "where is this logic?" questions, check `graphify-out/GRAPH_REPORT.md` before broad file reads.
- If `graphify-out/wiki/index.md` exists, use the wiki/community notes first and open raw source files only for the exact nodes or files needed.
- Prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` before broad grep/search. These commands traverse `graphify-out/graph.json` and usually cost fewer tokens than reading many files.
- The current graph was built AST-only to avoid semantic extraction token cost. Treat it as strong for code structure, imports, calls, classes, and functions; verify behavior-sensitive details in source before editing.
- After modifying code files, run `graphify update .` so `graphify-out/graph.json`, `GRAPH_REPORT.md`, and the wiki stay current.
- Do not run full semantic/deep graph extraction unless the user explicitly accepts the higher token cost.
