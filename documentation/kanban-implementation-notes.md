# Kanban Implementation Notes

## Arsitektur
- Komponen reusable: `components/kanban/process-kanban-board.tsx`
- Utility logic: `lib/kanban-utils.ts`
- Integrasi:
  - `app/dashboard/sales-orders/_components/sales-order-table.tsx`
  - `app/dashboard/deliveries/_components/delivery-table.tsx`
  - `app/dashboard/quotations/_components/quotation-table.tsx`

## Fitur Teknis
- Drag-and-drop menggunakan `@dnd-kit/core`
- Filter tanggal/customer/PIC/status
- Grouping `none | priority | deadline | customer`
- Quick actions card (print/duplicate/cancel/email)
- Role-aware actions berdasarkan permission modul
- Realtime update via React Query polling (`15s`)
- Lazy loading card per kolom dengan tombol `Load More`

## Database
- Script optimasi index:
  - `drizzle/0034_kanban_performance_indexes.sql`

## Testing
- Unit dan integration tests untuk utilitas dan workflow transisi.
