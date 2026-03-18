# Kanban Test Scenarios dan Hasil

## Unit Testing

### Scope
- Validasi transisi status
- Filtering data card
- Deadline grouping

### File
- `lib/__tests__/kanban-utils.test.ts`
- `lib/__tests__/kanban-workflow.integration.test.ts`

### Hasil
- Semua skenario unit dan workflow passing saat dijalankan dengan Vitest.

## Integration Testing

### Workflow Status Change
- Draft -> Confirmed -> Completed valid.
- Completed -> Draft invalid.
- Drag-and-drop ke kolom target invalid menampilkan error dan rollback state.

### Realtime Refresh
- Data direfresh berkala melalui polling React Query (`refetchInterval` 15 detik).
- Refresh manual via tombol refresh berhasil trigger refetch.

## User Acceptance Testing

### Checklist Proses Bisnis
- User bisa melihat Kanban pada Sales Order, Delivery, Quotation.
- User dengan role view-only tidak dapat drag status.
- User dengan role edit dapat drag status sesuai aturan.
- Quick action print/cancel/email berjalan pada card.
- Filter customer/tanggal/PIC/status mempengaruhi isi board.
- Grouping priority/deadline/customer sesuai pilihan.

## Performance Testing

### Target
- Load time < 3 detik untuk 500 records.

### Pendekatan
- Pagination/lazy loading per kolom (Load More).
- Polling interval terkontrol untuk update realtime.
- Index database ditambahkan untuk status/date/customer/sales-person.

### Hasil Verifikasi
- Pengukuran teknis perlu dijalankan pada environment UAT/production-like menggunakan dataset 500 record nyata.
