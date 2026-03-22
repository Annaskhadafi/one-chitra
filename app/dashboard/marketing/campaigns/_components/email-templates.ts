// Email template presets untuk form campaign
export interface EmailTemplate {
    label: string
    subject: string
    html: string
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
    {
        label: "🎉 Promo & Penawaran",
        subject: "Penawaran Spesial Hanya Untuk Anda!",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">
  <div style="background:linear-gradient(135deg,#1e3a5f,#2d6cdf);padding:40px 32px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:-0.5px;">🎉 Penawaran Spesial</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:15px;">Khusus untuk pelanggan setia kami</p>
  </div>
  <div style="padding:32px;background:#fff;border:1px solid #e5e7eb;border-top:none;">
    <p style="font-size:16px;">Halo <strong>{{name}}</strong>,</p>
    <p style="color:#555;line-height:1.7;">Kami memiliki penawaran eksklusif yang tidak boleh Anda lewatkan. Dapatkan harga terbaik untuk produk pilihan kami!</p>
    <div style="background:#f0f7ff;border-left:4px solid #2d6cdf;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
      <p style="margin:0;font-weight:bold;color:#1e3a5f;">✨ Diskon spesial untuk Anda</p>
      <p style="margin:4px 0 0;color:#555;font-size:14px;">Hubungi tim kami untuk informasi lebih lanjut</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="#" style="background:#2d6cdf;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">Hubungi Kami Sekarang</a>
    </div>
    <p style="color:#888;font-size:13px;line-height:1.6;">Terima kasih atas kepercayaan Anda. Kami selalu berusaha memberikan yang terbaik.<br>Salam hangat,<br><strong>Tim One Chitra</strong></p>
  </div>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;padding:16px 32px;text-align:center;border-radius:0 0 8px 8px;">
    <p style="color:#aaa;font-size:12px;margin:0;">© 2026 PT Chitra Paratama. Semua hak dilindungi.</p>
  </div>
</div>`,
    },
    {
        label: "🔔 Pengingat Pembelian",
        subject: "Sudah Lama Tidak Bertransaksi — Kami Rindu Anda!",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">
  <div style="background:#1e3a5f;padding:32px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:26px;">Halo, <strong>{{name}}</strong>!</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;">Kami rindu menyapa Anda 👋</p>
  </div>
  <div style="padding:32px;background:#fff;border:1px solid #e5e7eb;border-top:none;">
    <p style="color:#555;line-height:1.8;">Sudah cukup lama kami tidak melihat Anda bertransaksi. Kami harap semuanya baik-baik saja di pihak Anda.</p>
    <p style="color:#555;line-height:1.8;">Jika ada yang dapat kami bantu atau ada produk yang Anda cari, jangan ragu untuk menghubungi tim sales kami. Kami siap memberikan penawaran terbaik!</p>
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;background:#fafafa;">
      <p style="margin:0;font-weight:bold;">📞 Hubungi Tim Kami</p>
      <p style="margin:8px 0 0;color:#555;font-size:14px;line-height:1.6;">Email: sales@onechitragroup.com<br>Telp: (021) XXXX-XXXX</p>
    </div>
    <p style="color:#888;font-size:13px;">Salam,<br><strong>Tim Sales One Chitra</strong></p>
  </div>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;padding:16px;text-align:center;border-radius:0 0 8px 8px;">
    <p style="color:#aaa;font-size:12px;margin:0;">© 2026 PT Chitra Paratama</p>
  </div>
</div>`,
    },
    {
        label: "📰 Newsletter / Update",
        subject: "Update Terbaru dari One Chitra",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:32px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:26px;letter-spacing:-0.5px;">📰 Newsletter One Chitra</h1>
    <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">Edisi Bulan Ini</p>
  </div>
  <div style="padding:32px;background:#fff;border:1px solid #e5e7eb;border-top:none;">
    <p style="font-size:16px;">Halo <strong>{{name}}</strong>,</p>
    <p style="color:#555;line-height:1.7;">Berikut adalah update terbaru dari kami yang ingin kami bagikan kepada Anda.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <h2 style="font-size:18px;color:#1a1a2e;margin-bottom:8px;">🆕 Produk & Layanan Baru</h2>
    <p style="color:#555;line-height:1.7;">Kami terus berinovasi untuk memberikan produk berkualitas terbaik. [Tambahkan informasi produk baru di sini]</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <h2 style="font-size:18px;color:#1a1a2e;margin-bottom:8px;">📅 Event & Promo Mendatang</h2>
    <p style="color:#555;line-height:1.7;">[Tambahkan informasi event atau promo yang akan datang]</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <p style="color:#888;font-size:13px;line-height:1.6;">Terima kasih telah menjadi bagian dari keluarga besar One Chitra.<br><strong>Tim One Chitra</strong></p>
  </div>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;padding:16px;text-align:center;border-radius:0 0 8px 8px;">
    <p style="color:#aaa;font-size:12px;margin:0;">© 2026 PT Chitra Paratama. Unsubscribe</p>
  </div>
</div>`,
    },
]
