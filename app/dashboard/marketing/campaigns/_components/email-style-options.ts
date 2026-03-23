"use client"

export type EmailStyleOption = {
  value: string
  label: string
  description: string
}

export const EMAIL_STYLE_OPTIONS: EmailStyleOption[] = [
  { value: "promosi", label: "Promosi", description: "Penawaran promo, diskon, bundling, atau campaign penjualan." },
  { value: "penawaran", label: "Penawaran Harga", description: "Penawaran resmi yang lebih fokus ke value produk dan harga." },
  { value: "pemberitahuan", label: "Pemberitahuan", description: "Informasi penting, update layanan, atau pengumuman singkat." },
  { value: "follow-up", label: "Follow Up Sales", description: "Menindaklanjuti prospek, quotation, atau pembicaraan sebelumnya." },
  { value: "reaktivasi", label: "Reaktivasi Customer", description: "Mengaktifkan kembali customer yang mulai pasif atau lama tidak order." },
  { value: "peluncuran", label: "Peluncuran Produk", description: "Memperkenalkan produk, lini baru, atau stok unggulan." },
  { value: "edukasi", label: "Edukasi Produk", description: "Menjelaskan manfaat produk, aplikasi, dan insight teknis." },
  { value: "reminder", label: "Reminder", description: "Pengingat order, pembayaran, jadwal, atau tindak lanjut ringan." },
  { value: "undangan", label: "Undangan", description: "Undangan meeting, gathering, event, atau presentasi produk." },
  { value: "newsletter", label: "Newsletter", description: "Rangkuman update bisnis, produk, promo, dan insight berkala." },
  { value: "apresiasi", label: "Apresiasi", description: "Ucapan terima kasih, loyalitas, atau hubungan baik dengan customer." },
  { value: "survey", label: "Survey & Feedback", description: "Permintaan masukan, evaluasi layanan, atau kualitas produk." },
]

export function getEmailStyleMeta(value?: string) {
  return EMAIL_STYLE_OPTIONS.find((item) => item.value === value) || EMAIL_STYLE_OPTIONS[0]
}
