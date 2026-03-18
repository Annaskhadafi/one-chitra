# Requirements Document

## Introduction

Enhancement pada sistem approval workflow yang sudah ada (berbasis XState dan Next.js). Fitur ini menambahkan navigasi tab (Inbox, Status, Reports), layout detail approval dua kolom dengan action panel, tampilan visual workflow canvas, dan empat tipe step baru (Approval, Notification, Update User, User Input). Tujuannya adalah meningkatkan visibilitas, kontrol, dan kemudahan pengelolaan proses approval bagi approver maupun submitter.

## Glossary

- **Approval_Page**: Halaman utama approval di `/dashboard/approvals`
- **Inbox_Tab**: Tab yang menampilkan daftar task approval yang perlu diproses oleh user yang sedang login
- **Status_Tab**: Tab yang menampilkan semua approval request beserta statusnya, dengan filter dan bulk action
- **Reports_Tab**: Tab yang menampilkan ringkasan dan statistik approval
- **Detail_Page**: Halaman detail approval request di `/dashboard/approvals/[id]`
- **Action_Panel**: Panel kanan pada Detail_Page yang berisi informasi workflow dan tombol aksi (Revert, Approve, Reject, Comment)
- **Timeline**: Komponen yang menampilkan riwayat aktivitas approval secara kronologis
- **Workflow_Canvas**: Tampilan visual daftar step workflow dalam bentuk tabel dengan drag-reorder
- **Step_Type**: Kategori step dalam workflow: Approval, Notification, Update_User, atau User_Input
- **Approval_Request**: Satu instance pengajuan yang melewati proses workflow
- **Assignment**: Penugasan approval kepada seorang approver pada step tertentu
- **Submitter**: User yang mengajukan Approval_Request
- **Approver**: User yang ditugaskan untuk memproses step Approval

---

## Requirements

### Requirement 1: Tab Navigation

**User Story:** Sebagai user, saya ingin melihat halaman approval dengan navigasi tab yang jelas, sehingga saya dapat berpindah antara Inbox, Status, dan Reports dengan mudah.

#### Acceptance Criteria

1. THE Approval_Page SHALL menampilkan tiga tab navigasi: Inbox, Status, dan Reports.
2. WHEN user mengklik tab Inbox, THE Approval_Page SHALL menampilkan daftar pending tasks milik user yang sedang login.
3. WHEN user mengklik tab Status, THE Approval_Page SHALL menampilkan semua Approval_Request yang relevan dengan user yang sedang login.
4. WHEN user mengklik tab Reports, THE Approval_Page SHALL menampilkan ringkasan statistik approval.
5. WHEN halaman pertama kali dibuka, THE Approval_Page SHALL menampilkan tab Inbox sebagai tab aktif default.
6. THE Approval_Page SHALL mempertahankan tab yang aktif saat user melakukan navigasi kembali ke halaman ini dalam sesi yang sama.

---

### Requirement 2: Inbox Tab — Daftar Task

**User Story:** Sebagai approver, saya ingin melihat daftar task yang perlu saya proses dalam format tabel yang informatif, sehingga saya dapat dengan cepat mengidentifikasi dan memprioritaskan task.

#### Acceptance Criteria

1. THE Inbox_Tab SHALL menampilkan tabel dengan kolom: ID, Form, Submitter, Step, dan Submitted.
2. WHEN tidak ada pending task, THE Inbox_Tab SHALL menampilkan pesan kosong yang informatif.
3. THE Inbox_Tab SHALL menampilkan jumlah total pending task sebagai badge di header tab.
4. WHEN user mengklik baris pada tabel Inbox, THE Inbox_Tab SHALL menavigasi user ke Detail_Page dari Approval_Request tersebut.
5. THE Inbox_Tab SHALL menampilkan nama submitter (bukan hanya entity ID) pada kolom Submitter.
6. THE Inbox_Tab SHALL menampilkan tanggal submitted dalam format lokal Indonesia (id-ID).

---

### Requirement 3: Status Tab — Daftar Semua Request

**User Story:** Sebagai user, saya ingin melihat semua approval request dengan kemampuan filter dan bulk action, sehingga saya dapat memantau dan mengelola request secara efisien.

#### Acceptance Criteria

1. THE Status_Tab SHALL menampilkan filter status dengan pilihan: All, Pending, Complete, dan Cancelled.
2. THE Status_Tab SHALL menyediakan input pencarian berdasarkan ID request.
3. THE Status_Tab SHALL menyediakan filter berdasarkan rentang tanggal (date range) untuk field submittedAt.
4. THE Status_Tab SHALL menyediakan filter berdasarkan Workflow Form (formKey).
5. WHEN user memilih satu atau lebih baris, THE Status_Tab SHALL menampilkan tombol bulk action yang tersedia.
6. THE Status_Tab SHALL menyediakan tombol Export untuk mengunduh data yang sedang ditampilkan dalam format CSV atau XLSX.
7. WHEN filter diterapkan, THE Status_Tab SHALL menampilkan hanya Approval_Request yang sesuai dengan semua filter yang aktif.
8. WHEN filter direset, THE Status_Tab SHALL menampilkan kembali semua Approval_Request tanpa filter.

---

### Requirement 4: Detail Inbox — Layout Dua Kolom

**User Story:** Sebagai approver, saya ingin melihat detail approval request dalam layout dua kolom yang terstruktur, sehingga saya dapat melihat data form dan mengambil keputusan dalam satu tampilan.

#### Acceptance Criteria

1. THE Detail_Page SHALL menampilkan layout dua kolom: panel kiri untuk data form dan panel kanan untuk informasi workflow serta Action_Panel.
2. THE Detail_Page SHALL menampilkan field-field form dari snapshot data Approval_Request pada panel kiri.
3. THE Detail_Page SHALL menampilkan Timeline aktivitas approval di bawah panel kiri.
4. THE Action_Panel SHALL menampilkan informasi: Entry ID, tanggal Submitted, dan Status saat ini.
5. WHEN Approval_Request berstatus pending dan user adalah Approver yang ditugaskan pada step aktif, THE Action_Panel SHALL menampilkan tombol Approve dan Reject.
6. WHEN Approval_Request berstatus pending dan user adalah Submitter, THE Action_Panel SHALL menampilkan tombol Revert untuk menarik kembali request.
7. THE Action_Panel SHALL menyediakan input Comment yang dapat diisi sebelum melakukan aksi Approve, Reject, atau Revert.
8. IF workflowNotePolicy bernilai "required_on_approve", THEN THE Action_Panel SHALL memvalidasi bahwa Comment tidak kosong sebelum memproses aksi Approve.
9. IF workflowNotePolicy bernilai "required_on_reject", THEN THE Action_Panel SHALL memvalidasi bahwa Comment tidak kosong sebelum memproses aksi Reject.
10. IF workflowNotePolicy bernilai "required_always", THEN THE Action_Panel SHALL memvalidasi bahwa Comment tidak kosong sebelum memproses aksi Approve maupun Reject.
11. WHEN aksi berhasil diproses, THE Detail_Page SHALL me-refresh data dan menampilkan status terbaru tanpa full page reload.

---

### Requirement 5: Timeline Aktivitas

**User Story:** Sebagai user, saya ingin melihat riwayat aktivitas approval secara kronologis, sehingga saya dapat memahami progress dan keputusan yang telah diambil.

#### Acceptance Criteria

1. THE Timeline SHALL menampilkan setiap entri audit log secara kronologis dari yang terlama ke terbaru.
2. THE Timeline SHALL menampilkan informasi per entri: nama aktor, aksi yang dilakukan, tanggal/waktu, dan comment (jika ada).
3. THE Timeline SHALL membedakan secara visual antara aksi: submitted, approved, rejected, reverted, dan commented.
4. WHEN tidak ada riwayat aktivitas, THE Timeline SHALL menampilkan pesan yang menginformasikan bahwa belum ada aktivitas.
5. THE Timeline SHALL menampilkan tanggal dan waktu dalam format lokal Indonesia (id-ID).

---

### Requirement 6: Workflow Canvas — Tampilan Visual Step

**User Story:** Sebagai workflow admin, saya ingin melihat dan mengelola step-step workflow dalam tampilan visual canvas, sehingga saya dapat memahami dan mengatur urutan proses approval dengan mudah.

#### Acceptance Criteria

1. THE Workflow_Canvas SHALL menampilkan daftar step dalam bentuk tabel dengan kolom: Step Name, Step Type, dan Entries (jumlah request yang pernah melewati step tersebut).
2. THE Workflow_Canvas SHALL mendukung drag-and-drop untuk mengubah urutan step.
3. WHEN urutan step diubah melalui drag-and-drop, THE Workflow_Canvas SHALL menyimpan urutan baru ke database.
4. THE Workflow_Canvas SHALL menampilkan ikon atau badge yang membedakan setiap Step_Type secara visual.
5. WHEN user mengklik sebuah step, THE Workflow_Canvas SHALL menampilkan form edit untuk step tersebut.
6. THE Workflow_Canvas SHALL menyediakan tombol untuk menambah step baru.
7. WHEN step baru ditambahkan, THE Workflow_Canvas SHALL meminta user memilih Step_Type terlebih dahulu.

---

### Requirement 7: Step Types

**User Story:** Sebagai workflow admin, saya ingin mengkonfigurasi berbagai tipe step dalam workflow, sehingga saya dapat membangun proses yang sesuai dengan kebutuhan bisnis.

#### Acceptance Criteria

1. THE Workflow_Canvas SHALL mendukung empat Step_Type: Approval, Notification, Update_User, dan User_Input.
2. WHEN Step_Type adalah Approval, THE Workflow_Canvas SHALL memungkinkan konfigurasi approver (berdasarkan role atau user spesifik), minimum jumlah approval, dan workflowNotePolicy.
3. WHEN Step_Type adalah Notification, THE Workflow_Canvas SHALL memungkinkan konfigurasi penerima notifikasi (email/role) dan template pesan.
4. WHEN Step_Type adalah Update_User, THE Workflow_Canvas SHALL memungkinkan konfigurasi field yang akan diupdate dan nilai barunya berdasarkan data dari snapshot request.
5. WHEN Step_Type adalah User_Input, THE Workflow_Canvas SHALL memungkinkan konfigurasi field-field input yang harus diisi oleh user sebelum workflow dapat melanjutkan ke step berikutnya.
6. THE Workflow_Canvas SHALL memvalidasi bahwa setiap step memiliki konfigurasi yang lengkap sebelum workflow dapat diaktifkan.
7. IF konfigurasi step tidak lengkap, THEN THE Workflow_Canvas SHALL menampilkan pesan error yang menjelaskan field mana yang belum dikonfigurasi.

---

### Requirement 8: Reports Tab — Statistik Approval

**User Story:** Sebagai manager, saya ingin melihat statistik dan ringkasan proses approval, sehingga saya dapat memantau performa dan mengidentifikasi bottleneck.

#### Acceptance Criteria

1. THE Reports_Tab SHALL menampilkan total jumlah Approval_Request berdasarkan status: Pending, Complete, dan Cancelled.
2. THE Reports_Tab SHALL menampilkan rata-rata waktu penyelesaian (dari submittedAt hingga completedAt) untuk request yang berstatus Complete.
3. THE Reports_Tab SHALL menampilkan daftar step dengan jumlah request yang sedang pending di step tersebut, diurutkan dari terbanyak.
4. THE Reports_Tab SHALL menyediakan filter berdasarkan rentang tanggal untuk semua metrik yang ditampilkan.
5. WHEN filter tanggal diterapkan, THE Reports_Tab SHALL memperbarui semua metrik sesuai rentang tanggal yang dipilih.

---

### Requirement 9: Aksi Revert

**User Story:** Sebagai submitter, saya ingin dapat menarik kembali approval request yang sudah saya submit, sehingga saya dapat melakukan koreksi sebelum diproses lebih lanjut.

#### Acceptance Criteria

1. WHEN Approval_Request berstatus pending dan belum ada keputusan approve/reject dari Approver manapun, THE Action_Panel SHALL menampilkan tombol Revert kepada Submitter.
2. WHEN Submitter mengklik Revert, THE Action_Panel SHALL meminta konfirmasi sebelum memproses aksi.
3. WHEN Revert dikonfirmasi, THE Approval_Page SHALL mengubah status Approval_Request menjadi "cancelled" dan mencatat entri di audit log.
4. WHEN Revert berhasil, THE Detail_Page SHALL menampilkan status terbaru dan menonaktifkan semua tombol aksi.
5. IF Approval_Request sudah memiliki keputusan dari Approver, THEN THE Action_Panel SHALL tidak menampilkan tombol Revert.

---

### Requirement 10: Aksesibilitas dan Responsivitas

**User Story:** Sebagai user, saya ingin antarmuka approval dapat digunakan dengan nyaman di berbagai ukuran layar, sehingga saya dapat mengakses dan memproses approval dari perangkat apapun.

#### Acceptance Criteria

1. THE Approval_Page SHALL dapat digunakan pada viewport dengan lebar minimal 768px (tablet) tanpa horizontal scroll yang tidak diinginkan.
2. WHEN viewport lebih kecil dari 1024px, THE Detail_Page SHALL menampilkan panel kiri dan panel kanan secara vertikal (stacked) bukan berdampingan.
3. THE Approval_Page SHALL memiliki label yang dapat dibaca oleh screen reader pada semua tombol aksi interaktif.
4. THE Workflow_Canvas SHALL menampilkan pesan yang sesuai ketika drag-and-drop tidak tersedia (misalnya pada perangkat touch).
