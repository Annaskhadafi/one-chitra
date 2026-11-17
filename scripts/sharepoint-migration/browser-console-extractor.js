/**
 * SharePoint Vendor Invoice & Attachment Extractor Tool
 * ---------------------------------------------------
 * Cara Menggunakan:
 * 1. Buka tab SharePoint "VMS - INVOICE VENDOR" di browser Anda (yang sudah login).
 * 2. Tekan F12 atau klik kanan -> Inspect -> Buka tab "Console".
 * 3. Copy seluruh kode ini dan paste di Console, lalu tekan Enter.
 * 4. Akan muncul panel kontrol modern di pojok kanan atas browser Anda.
 */

(async function () {
  console.log("🚀 Menginisialisasi SharePoint Invoice & Attachment Extractor...");

  // Hapus widget lama jika sudah ada
  const oldWidget = document.getElementById("sp-extractor-widget");
  if (oldWidget) oldWidget.remove();

  // Buat floating UI
  const widget = document.createElement("div");
  widget.id = "sp-extractor-widget";
  widget.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 380px;
    background: #ffffff;
    color: #1e293b;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    border: 1px solid #cbd5e1;
    overflow: hidden;
  `;

  widget.innerHTML = `
    <div style="background: #0f172a; color: white; padding: 12px 16px; font-weight: 600; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
      <span>📥 SharePoint Attachment Downloader</span>
      <button id="sp-close-btn" style="background: none; border: none; color: #94a3b8; font-size: 18px; cursor: pointer;">✕</button>
    </div>
    <div style="padding: 16px; font-size: 13px;">
      <div id="sp-status" style="margin-bottom: 12px; color: #475569; font-weight: 500;">
        Siap memindai data SharePoint...
      </div>
      <div style="background: #f1f5f9; border-radius: 6px; height: 8px; overflow: hidden; margin-bottom: 12px;">
        <div id="sp-progress-bar" style="background: #2563eb; width: 0%; height: 100%; transition: width 0.3s;"></div>
      </div>
      <div id="sp-stats" style="font-size: 12px; color: #64748b; margin-bottom: 16px; line-height: 1.5;">
        Items: <b>0</b> | Attachments Ditemukan: <b>0</b> | Downloaded: <b>0</b>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button id="sp-scan-btn" style="background: #2563eb; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer;">
          1. Pindai Daftar Lampiran (Scan)
        </button>
        <button id="sp-export-json-btn" disabled style="background: #059669; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; opacity: 0.6;">
          2. Download Manifest JSON (Untuk Skrip Otomatis)
        </button>
        <button id="sp-download-all-btn" disabled style="background: #d97706; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; opacity: 0.6;">
          3. Unduh Semua File PDF Langsung di Browser
        </button>
      </div>
      <div style="margin-top: 12px; font-size: 11px; color: #94a3b8; text-align: center;">
        One Chitra Migration Tool • PT Chitra Paratama
      </div>
    </div>
  `;

  document.body.appendChild(widget);

  const statusEl = document.getElementById("sp-status");
  const progressBar = document.getElementById("sp-progress-bar");
  const statsEl = document.getElementById("sp-stats");
  const scanBtn = document.getElementById("sp-scan-btn");
  const exportJsonBtn = document.getElementById("sp-export-json-btn");
  const downloadAllBtn = document.getElementById("sp-download-all-btn");
  const closeBtn = document.getElementById("sp-close-btn");

  closeBtn.onclick = () => widget.remove();

  let scannedAttachments = [];
  const siteUrl = window.location.origin + window.location.pathname.split("/Lists/")[0];
  const listName = "INVOICE VENDOR";

  // 1. SCAN FUNCTION
  scanBtn.onclick = async () => {
    scanBtn.disabled = true;
    scanBtn.style.opacity = "0.6";
    statusEl.innerHTML = "🔍 Mengambil data dari SharePoint REST API...";
    scannedAttachments = [];

    try {
      let nextUrl = `${siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listName)}')/items?$select=Id,Title,AttachmentFiles&$expand=AttachmentFiles&$top=5000`;
      let totalItems = 0;

      while (nextUrl) {
        statusEl.innerHTML = `📡 Mengunduh metadata batch (${totalItems} items diproses)...`;
        const res = await fetch(nextUrl, {
          headers: {
            "Accept": "application/json;odata=verbose"
          }
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Gagal memanggil API SharePoint.`);
        }

        const data = await res.json();
        const results = data.d?.results || [];
        totalItems += results.length;

        for (const item of results) {
          const files = item.AttachmentFiles?.results || [];
          for (const f of files) {
            scannedAttachments.push({
              itemId: item.Id,
              itemTitle: item.Title || "",
              fileName: f.FileName,
              serverRelativeUrl: f.ServerRelativeUrl,
              downloadUrl: window.location.origin + f.ServerRelativeUrl
            });
          }
        }

        statsEl.innerHTML = `Items: <b>${totalItems}</b> | Attachments Ditemukan: <b>${scannedAttachments.length}</b> | Downloaded: <b>0</b>`;
        nextUrl = data.d?.__next || null;
      }

      statusEl.innerHTML = `✅ Selesai! Ditemukan <b>${scannedAttachments.length}</b> berkas lampiran.`;
      progressBar.style.width = "100%";
      exportJsonBtn.disabled = false;
      exportJsonBtn.style.opacity = "1";
      downloadAllBtn.disabled = false;
      downloadAllBtn.style.opacity = "1";

      console.log("Daftar Lampiran Berhasil Dipindai:", scannedAttachments);
    } catch (err) {
      console.error(err);
      statusEl.innerHTML = `<span style="color: #dc2626;">❌ Error: ${err.message}</span>`;
      scanBtn.disabled = false;
      scanBtn.style.opacity = "1";
    }
  };

  // 2. EXPORT JSON MANIFEST
  exportJsonBtn.onclick = () => {
    if (!scannedAttachments.length) return;
    const blob = new Blob([JSON.stringify(scannedAttachments, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sharepoint_invoice_attachments_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    statusEl.innerHTML = "💾 Manifest JSON berhasil diunduh ke folder Downloads Anda!";
  };

  // 3. DOWNLOAD ALL FILES DIRECTLY IN BROWSER
  downloadAllBtn.onclick = async () => {
    if (!scannedAttachments.length) return;
    if (!confirm(`Apakah Anda yakin ingin mulai mengunduh ${scannedAttachments.length} file PDF ke folder Downloads browser Anda?\n\nPastikan popup download diizinkan jika browser memintanya.`)) {
      return;
    }

    downloadAllBtn.disabled = true;
    downloadAllBtn.style.opacity = "0.6";

    let downloadedCount = 0;
    const total = scannedAttachments.length;

    for (let i = 0; i < total; i++) {
      const fileInfo = scannedAttachments[i];
      statusEl.innerHTML = `⏳ Mengunduh (${i + 1}/${total}): <span style="font-size: 11px; word-break: break-all;">${fileInfo.fileName}</span>`;

      try {
        const fileRes = await fetch(fileInfo.downloadUrl);
        if (fileRes.ok) {
          const blob = await fileRes.blob();
          const fileUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = fileUrl;
          // Prefix dengan itemId agar nama unik dan mudah di-mapping: misal 3474_ODG - 4808.pdf
          a.download = `${fileInfo.itemId}_${fileInfo.fileName}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
          downloadedCount++;
        }
      } catch (err) {
        console.warn(`Gagal mengunduh item ${fileInfo.itemId}: ${fileInfo.fileName}`, err);
      }

      const pct = Math.round(((i + 1) / total) * 100);
      progressBar.style.width = `${pct}%`;
      statsEl.innerHTML = `Items: <b>${total}</b> | Attachments: <b>${total}</b> | Downloaded: <b>${downloadedCount}</b> (${pct}%)`;

      // Delay 300ms agar browser stabil dan tidak diblokir antispam
      await new Promise((r) => setTimeout(r, 300));
    }

    statusEl.innerHTML = `🎉 Selesai! ${downloadedCount} berkas PDF berhasil diunduh ke folder Downloads.`;
  };
})();
