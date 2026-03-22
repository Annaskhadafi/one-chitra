# Implementation Plan: Approval Workflow Enhancement

## Overview

Implementasi dilakukan secara incremental: dimulai dari pure functions dan server actions (mudah di-test), lalu UI components, kemudian integrasi dan wiring. Semua perubahan bersifat additive terhadap kode yang sudah ada.

## Tasks

- [x] 1. Buat pure utility functions dan types
  - [x] 1.1 Buat file types dan interfaces baru
    - Buat `app/dashboard/approvals/_lib/types.ts` dengan semua type: `PendingTask`, `ApprovalStatusItem`, `StatusFilter`, `ApprovalReportsData`, `StepReorderItem`, `TimelineEntry`, `WorkflowStep`, `UIStepType`, `ActionResult<T>`
    - Buat `app/dashboard/approvals/_lib/step-config-types.ts` dengan `BaseStepConfig`, `ApprovalStepConfig`, `NotificationStepConfig`, `UpdateUserStepConfig`, `UserInputStepConfig`
    - _Requirements: 2.1, 3.1, 4.4, 5.2, 6.1, 7.1_

  - [x] 1.2 Buat pure validation dan utility functions
    - Buat `app/dashboard/approvals/_lib/utils.ts`
    - Implementasi `validateNotePolicy(policy, comment, action)` → boolean
    - Implementasi `hasAnyApproverDecision(assignments)` → boolean
    - Implementasi `canRevert(request, assignments, userId)` → boolean
    - Implementasi `applyStatusFilters(items, filter)` → filtered array
    - Implementasi `validateStepReorder(original, reordered)` → boolean
    - Implementasi `sortTimelineEntries(entries)` → sorted array
    - _Requirements: 4.8, 4.9, 4.10, 9.1, 9.5, 3.7, 6.2, 5.1_

  - [ ]* 1.3 Tulis property-based tests untuk utility functions
    - Buat `app/dashboard/approvals/_lib/__tests__/utils.property.test.ts`
    - **Property 1: workflowNotePolicy approve validation** — generate random policy + comment strings (termasuk whitespace-only), verifikasi `validateNotePolicy` menolak approve tepat ketika policy mensyaratkan comment dan comment kosong/whitespace
    - **Validates: Requirements 4.8, 4.10**
    - **Property 2: workflowNotePolicy reject validation** — sama untuk aksi reject
    - **Validates: Requirements 4.9, 4.10**
    - **Property 3: Revert guard** — generate random request + assignments + userId, verifikasi `canRevert` hanya true ketika semua tiga kondisi terpenuhi
    - **Validates: Requirements 9.1, 9.5**
    - **Property 4: Status filter subset correctness** — generate random `ApprovalStatusItem[]` + random `StatusFilter`, verifikasi hasil `applyStatusFilters` adalah subset dari input dan setiap item memenuhi semua filter aktif
    - **Validates: Requirements 3.7, 3.8**
    - **Property 5: Step reorder validity** — generate random step IDs + permutasi stepOrder, verifikasi `validateStepReorder` valid hanya ketika same IDs, no duplicates, positive integers
    - **Validates: Requirements 6.2, 6.3**
    - **Property 6: Timeline chronological order** — generate random `TimelineEntry[]` dengan random `createdAt`, verifikasi `sortTimelineEntries` menghasilkan array ascending by `createdAt` dengan panjang sama
    - **Validates: Requirements 5.1, 5.2**
    - Tag setiap test: `// Feature: approval-workflow-enhancement, Property N: <property_text>`

- [ ] 2. Implementasi server actions baru
  - [x] 2.1 Tambah `getApprovalStatusList(filters)` di `app/actions/approval.ts`
    - Query semua approval requests dengan join ke users untuk `requesterName`
    - Terapkan filter: status, search by requestId, dateFrom/dateTo, formKey
    - Return `ApprovalStatusItem[]`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7_

  - [x] 2.2 Tambah `getApprovalReports(dateRange)` di `app/actions/approval.ts`
    - Query count by status, avg completion days (completedAt - submittedAt), step bottlenecks
    - Return `ApprovalReportsData`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 2.3 Tambah `revertApprovalRequest(requestId)` di `app/actions/approval.ts`
    - Validasi: caller = submitter, status = pending, tidak ada assignment dengan status approved/rejected
    - Gunakan `canRevert` dan `hasAnyApproverDecision` dari utils
    - Update status request ke "cancelled", insert audit log entry
    - Return `ActionResult`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 2.4 Tambah `reorderWorkflowSteps(definitionId, stepReorderItems[])` di `app/actions/approval.ts`
    - Validasi: no duplicate stepOrders, semua stepIds milik definitionId, semua stepOrder positive integers
    - Gunakan `validateStepReorder` dari utils
    - Update stepOrder di DB dalam satu transaksi
    - Return `ActionResult`
    - _Requirements: 6.2, 6.3_

  - [x] 2.5 Tambah `addWorkflowStep(definitionId, stepType, config)` dan `updateWorkflowStep(stepId, config)` di `app/actions/approval.ts`
    - Validasi config required fields per nodeKind sebelum insert/update
    - Simpan config ke `conditionJson`
    - Return `ActionResult`
    - _Requirements: 6.6, 6.7, 7.2, 7.3, 7.4, 7.5_

  - [x] 2.6 Extend `submitApprovalDecision` untuk validasi `workflowNotePolicy`
    - Ambil `workflowNotePolicy` dari step config
    - Gunakan `validateNotePolicy` dari utils sebelum memproses keputusan
    - Return error jika validasi gagal
    - _Requirements: 4.8, 4.9, 4.10_

- [x] 3. Checkpoint — Pastikan semua tests pass
  - Jalankan semua property tests dan unit tests, tanyakan ke user jika ada pertanyaan.

- [x] 4. Implementasi tab shell dan Inbox Tab
  - [x] 4.1 Refaktor `app/dashboard/approvals/page.tsx` menjadi Client Component tab shell
    - Baca `?tab=` dari URL search params, default ke "inbox"
    - Render shadcn `<Tabs>` dengan tiga tab: Inbox, Status, Reports
    - Tampilkan badge count di tab Inbox (dari `getApprovalInbox()`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 4.2 Buat `app/dashboard/approvals/_components/inbox-tab.tsx` sebagai Server Component
    - Fetch data via `getApprovalInbox()` yang sudah ada
    - Render tabel dengan kolom: ID, Form, Submitter, Step, Submitted
    - Format tanggal dengan `id-ID` locale
    - Tampilkan empty state jika tidak ada pending tasks
    - Klik baris navigasi ke `/dashboard/approvals/${requestId}`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 5. Implementasi Status Tab
  - [x] 5.1 Buat `app/dashboard/approvals/_components/status-tab.tsx` sebagai Client Component
    - Filter state: status, search, dateFrom, dateTo, formKey — sync ke URL params
    - Panggil `getApprovalStatusList(filters)` saat filter berubah
    - Render tabel dengan kolom sesuai `ApprovalStatusItem`
    - Implementasi checkbox selection untuk bulk action
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8_

  - [x] 5.2 Tambah export CSV/XLSX ke Status Tab
    - Tombol Export menggunakan library `xlsx` yang sudah ada
    - Export data yang sedang ditampilkan (setelah filter diterapkan)
    - Support format CSV dan XLSX
    - _Requirements: 3.6_

- [ ] 6. Implementasi Detail Page layout dua kolom
  - [x] 6.1 Refaktor `app/dashboard/approvals/[requestId]/page.tsx` ke layout dua kolom
    - Grid `grid-cols-1 lg:grid-cols-3`
    - Panel kiri (lg:col-span-2): render conditionSnapshot fields sebagai key-value pairs + `<Timeline />`
    - Panel kanan (lg:col-span-1): entry info + `<ActionPanel />`
    - _Requirements: 4.1, 4.2, 4.3, 10.2_

  - [x] 6.2 Buat `app/dashboard/approvals/[requestId]/_components/timeline.tsx` sebagai Client Component
    - Render vertical timeline dengan dot berwarna per action type
    - Warna: submitted=blue, approved=green, rejected=red, reverted=orange, commented=gray
    - Format tanggal/waktu dengan `id-ID` locale
    - Tampilkan empty state jika tidak ada entries
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.3 Buat `app/dashboard/approvals/_components/action-panel.tsx` sebagai Client Component
    - Tampilkan Entry ID, Submitted, Status badge
    - Tombol Approve/Reject: tampil jika `isAssignedApprover && status === "pending"`
    - Tombol Revert: tampil jika `canRevert` true (gunakan utils)
    - Comment input: selalu tampil, validasi client-side sesuai `workflowNotePolicy`
    - Konfirmasi dialog sebelum Revert
    - Gunakan `useTransition` untuk feedback tanpa full reload, refresh data setelah aksi berhasil
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 9.2, 9.4, 10.3_

- [x] 7. Checkpoint — Pastikan semua tests pass
  - Jalankan semua tests, verifikasi layout responsif di 768px dan 1024px, tanyakan ke user jika ada pertanyaan.

- [ ] 8. Implementasi Reports Tab
  - [x] 8.1 Buat `app/dashboard/approvals/_components/reports-tab.tsx` sebagai Client Component
    - Date range filter state (dateFrom, dateTo)
    - Panggil `getApprovalReports(dateRange)` saat filter berubah
    - Tampilkan stat cards: Pending, Complete, Cancelled counts
    - Tampilkan avg completion days
    - Tampilkan tabel step bottlenecks diurutkan dari pendingCount terbanyak
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 9. Implementasi Workflow Canvas
  - [x] 9.1 Buat `app/dashboard/approvals/matrix/_components/workflow-canvas.tsx` sebagai Client Component
    - Render tabel step dengan kolom: Step Name, Step Type (dengan ikon/badge), Entries
    - Integrasikan `@dnd-kit/core` + `@dnd-kit/sortable` untuk drag-and-drop reorder
    - Optimistic update saat drag, panggil `reorderWorkflowSteps` untuk persist
    - Revert optimistic update dan tampilkan toast jika server action gagal
    - Tampilkan pesan fallback untuk touch devices
    - Tombol tambah step baru
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 10.4_

  - [x] 9.2 Buat `app/dashboard/approvals/matrix/_components/step-type-selector.tsx` sebagai Client Component
    - Modal/dialog untuk memilih Step_Type saat menambah step baru
    - Tampilkan 4 pilihan: Approval, Notification, Update User, User Input dengan deskripsi
    - _Requirements: 6.7, 7.1_

  - [x] 9.3 Buat `app/dashboard/approvals/matrix/_components/step-config-form.tsx` sebagai Client Component
    - Form berbeda per `UIStepType` (conditional rendering)
    - Approval: approverType, approverRole/approverUserId, minApprovals, workflowNotePolicy
    - Notification: recipients, messageTemplate
    - Update_User: targetField, newValue
    - User_Input: inputFields[] (key, label, type, required, options)
    - Validasi required fields per step type sebelum submit
    - Tampilkan error message per field yang belum dikonfigurasi
    - Panggil `addWorkflowStep` atau `updateWorkflowStep` sesuai mode
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 10. Final checkpoint — Pastikan semua tests pass
  - Jalankan semua tests, verifikasi semua requirements tercakup, tanyakan ke user jika ada pertanyaan.

## Notes

- Tasks bertanda `*` bersifat opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan requirements spesifik untuk traceability
- Pure functions di `_lib/utils.ts` harus diimplementasi sebelum server actions karena server actions menggunakannya
- Property tests menggunakan `fast-check` yang sudah tersedia di project
- Semua server actions mengikuti pola `ActionResult<T>` yang sudah ada
