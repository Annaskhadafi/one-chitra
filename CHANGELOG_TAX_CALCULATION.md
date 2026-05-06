# PERUBAHAN PERHITUNGAN TAX DI QUOTATION

Tanggal: 2026-05-04

## Masalah
Sebelumnya, perhitungan tax dilakukan SEBELUM discount diterapkan.

## Solusi
Sekarang perhitungan tax dilakukan SETELAH discount diterapkan.

## Formula Baru:
1. Subtotal = Sum of (quantity × unitPrice - item discount)
2. Discount Amount = Subtotal × discount% (atau fixed discount)
3. Subtotal After Discount = Subtotal - Discount Amount
4. Tax = Subtotal After Discount × 11% (atau proportional dari item tax)
5. Grand Total = Subtotal After Discount + Tax + Shipping

## File yang Diubah:

### 1. app/dashboard/quotations/_components/quotation-form.tsx
   - Mengubah logika `quotationTax` useMemo
   - Tax sekarang dihitung dari subtotal setelah discount
   - Menambahkan dependency array: [items, tax, subTotal, discount, discountType]

### 2. app/dashboard/quotations/_components/quotation-pdf-generator.ts
   - Menambahkan variabel `subtotalAfterDiscount`
   - Mengubah perhitungan `taxAmount` untuk menggunakan subtotalAfterDiscount
   - Mengubah perhitungan `grandTotal`

### 3. app/dashboard/quotations/_components/quotation-detail.tsx
   - Menambahkan variabel `discountAmount` dan `subtotalAfterDiscount`
   - Mengubah perhitungan `quotationTaxAmount`
   - Mengubah perhitungan `grandTotal`

### 4. app/dashboard/quotations/_components/quotation-pdf-preview.tsx
   - Menambahkan variabel `subtotalAfterDiscount`
   - Mengubah perhitungan `taxAmount`
   - Mengubah perhitungan `grandTotal`

## Catatan:
- Perubahan ini mempengaruhi tampilan form quotation, PDF generator, detail view, dan PDF preview
- Semua perhitungan sekarang konsisten: TAX AFTER DISCOUNT
- Backup file tersimpan di: quotation-form-backup.tsx
