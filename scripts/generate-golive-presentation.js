/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const fs = require("fs");
const PptxGenJS = require("pptxgenjs");

const pptx = new PptxGenJS();

pptx.layout = "LAYOUT_WIDE";
pptx.author = "OpenAI Codex";
pptx.company = "Chitra Paratama";
pptx.subject = "One Chitra go-live presentation";
pptx.title = "One Chitra Go-Live Presentation";
pptx.lang = "id-ID";
pptx.theme = {
  headFontFace: "Aptos Display",
  bodyFontFace: "Aptos",
  lang: "id-ID",
};

const outputDir = path.resolve(__dirname, "..", "presentation");
const outputFile = path.join(outputDir, "one-chitra-golive-presentation.pptx");
const logoPath = path.resolve(__dirname, "..", "public", "logo.png");

const COLORS = {
  navy: "0F2747",
  blue: "0B5CAD",
  teal: "11A2C8",
  lime: "8CCF4D",
  ink: "16324F",
  slate: "5B6B7A",
  line: "D8E3EC",
  soft: "F5F9FC",
  white: "FFFFFF",
  dark: "0B1D33",
  warn: "F59E0B",
};

function addBase(slide, pageNo, title, subtitle) {
  slide.background = { color: COLORS.white };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.18,
    line: { color: COLORS.navy, transparency: 100 },
    fill: { color: COLORS.navy },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 7.16,
    w: 13.333,
    h: 0.34,
    line: { color: COLORS.soft, transparency: 100 },
    fill: { color: COLORS.soft },
  });
  slide.addText(title, {
    x: 0.58,
    y: 0.44,
    w: 9.6,
    h: 0.48,
    fontSize: 24,
    bold: true,
    color: COLORS.ink,
    margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.58,
      y: 0.94,
      w: 10.8,
      h: 0.36,
      fontSize: 10.5,
      color: COLORS.slate,
      margin: 0,
    });
  }
  slide.addText(String(pageNo).padStart(2, "0"), {
    x: 12.35,
    y: 0.48,
    w: 0.42,
    h: 0.32,
    fontSize: 10,
    color: COLORS.blue,
    bold: true,
    align: "right",
    margin: 0,
  });
  slide.addText("One Chitra | Go-Live Presentation", {
    x: 0.58,
    y: 7.22,
    w: 3.8,
    h: 0.14,
    fontSize: 8.5,
    color: COLORS.slate,
    margin: 0,
  });
}

function addCard(slide, opts) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    rectRadius: 0.08,
    line: { color: opts.lineColor || COLORS.line, pt: 1 },
    fill: { color: opts.fillColor || COLORS.white },
    shadow: {
      type: "outer",
      color: "CAD6E2",
      blur: 1,
      angle: 45,
      distance: 1,
      opacity: 0.12,
    },
  });
}

function addMetricCard(slide, x, y, w, h, value, label, accent) {
  addCard(slide, { x, y, w, h, fillColor: COLORS.white });
  slide.addShape(pptx.ShapeType.rect, {
    x: x + 0.18,
    y: y + 0.18,
    w: 0.1,
    h: h - 0.36,
    line: { color: accent, transparency: 100 },
    fill: { color: accent },
  });
  slide.addText(value, {
    x: x + 0.42,
    y: y + 0.34,
    w: w - 0.58,
    h: 0.44,
    fontSize: 22,
    bold: true,
    color: COLORS.ink,
    margin: 0,
  });
  slide.addText(label, {
    x: x + 0.42,
    y: y + 0.92,
    w: w - 0.58,
    h: 0.5,
    fontSize: 10.5,
    color: COLORS.slate,
    margin: 0,
    fit: "shrink",
  });
}

function addTextBox(slide, x, y, w, h, title, body, accent) {
  addCard(slide, { x, y, w, h, fillColor: COLORS.white });
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w: 0.12,
    h,
    line: { color: accent || COLORS.blue, transparency: 100 },
    fill: { color: accent || COLORS.blue },
  });
  slide.addText(title, {
    x: x + 0.24,
    y: y + 0.18,
    w: w - 0.4,
    h: 0.28,
    fontSize: 13,
    bold: true,
    color: COLORS.ink,
    margin: 0,
  });
  slide.addText(body, {
    x: x + 0.24,
    y: y + 0.56,
    w: w - 0.38,
    h: h - 0.72,
    fontSize: 10.5,
    color: COLORS.slate,
    margin: 0,
    fit: "shrink",
    breakLine: false,
    valign: "top",
  });
}

function addProcessStep(slide, x, y, w, h, num, title, body, accent) {
  addCard(slide, { x, y, w, h, fillColor: COLORS.white });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: x + 0.18,
    y: y + 0.16,
    w: 0.42,
    h: 0.42,
    line: { color: accent, transparency: 100 },
    fill: { color: accent },
  });
  slide.addText(String(num), {
    x: x + 0.18,
    y: y + 0.19,
    w: 0.42,
    h: 0.3,
    fontSize: 12,
    bold: true,
    color: COLORS.white,
    align: "center",
    margin: 0,
  });
  slide.addText(title, {
    x: x + 0.74,
    y: y + 0.18,
    w: w - 0.92,
    h: 0.26,
    fontSize: 12.5,
    bold: true,
    color: COLORS.ink,
    margin: 0,
  });
  slide.addText(body, {
    x: x + 0.18,
    y: y + 0.72,
    w: w - 0.32,
    h: h - 0.92,
    fontSize: 10,
    color: COLORS.slate,
    margin: 0,
    fit: "shrink",
  });
}

function addPill(slide, x, y, w, text, fill, textColor) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.32,
    rectRadius: 0.1,
    line: { color: fill, transparency: 100 },
    fill: { color: fill },
  });
  slide.addText(text, {
    x,
    y: y + 0.05,
    w,
    h: 0.18,
    fontSize: 8.5,
    bold: true,
    color: textColor,
    align: "center",
    margin: 0,
  });
}

function addLayer(slide, x, y, w, h, label, items, fill, textColor) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    line: { color: fill, transparency: 100 },
    fill: { color: fill },
  });
  slide.addText(label, {
    x: x + 0.18,
    y: y + 0.14,
    w: w - 0.36,
    h: 0.26,
    fontSize: 12.5,
    bold: true,
    color: textColor,
    margin: 0,
  });
  slide.addText(items, {
    x: x + 0.18,
    y: y + 0.48,
    w: w - 0.36,
    h: h - 0.62,
    fontSize: 10,
    color: textColor,
    margin: 0,
    fit: "shrink",
  });
}

function addRecommendation(slide, text) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.72,
    y: 6.18,
    w: 11.92,
    h: 0.54,
    rectRadius: 0.08,
    line: { color: COLORS.warn, pt: 1 },
    fill: { color: "FFF7E6" },
  });
  slide.addText(text, {
    x: 0.92,
    y: 6.33,
    w: 11.52,
    h: 0.18,
    fontSize: 10,
    bold: true,
    color: "8A5A00",
    margin: 0,
    fit: "shrink",
  });
}

function slideClosingBanner(slide) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.72,
    y: 5.16,
    w: 11.9,
    h: 1.04,
    rectRadius: 0.08,
    line: { color: COLORS.navy, transparency: 100 },
    fill: { color: COLORS.navy },
  });
  slide.addText("One Chitra siap dipresentasikan sebagai platform operasi terintegrasi berbasis SAP dengan kontrol, visibilitas, dan arah pengembangan yang jelas.", {
    x: 0.98,
    y: 5.42,
    w: 8.72,
    h: 0.34,
    fontSize: 16,
    bold: true,
    color: COLORS.white,
    margin: 0,
    fit: "shrink",
  });
  slide.addText("Discussion | Decision | Controlled Go-Live", {
    x: 0.98,
    y: 5.84,
    w: 4.8,
    h: 0.2,
    fontSize: 10,
    color: "BFD4E8",
    margin: 0,
  });
  if (fs.existsSync(logoPath)) {
    slide.addImage({
      path: logoPath,
      x: 10.66,
      y: 5.28,
      w: 1.34,
      h: 1.34,
    });
  }
}

function buildSlides() {
  const cover = pptx.addSlide();
  cover.background = { color: COLORS.dark };
  cover.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    line: { color: COLORS.dark, transparency: 100 },
    fill: { color: COLORS.dark },
  });
  cover.addShape(pptx.ShapeType.ellipse, {
    x: 8.4,
    y: -0.8,
    w: 4.2,
    h: 4.2,
    line: { color: COLORS.teal, transparency: 100 },
    fill: { color: COLORS.teal, transparency: 72 },
  });
  cover.addShape(pptx.ShapeType.ellipse, {
    x: 9.8,
    y: 4.5,
    w: 2.2,
    h: 2.2,
    line: { color: COLORS.lime, transparency: 100 },
    fill: { color: COLORS.lime, transparency: 76 },
  });
  cover.addShape(pptx.ShapeType.rect, {
    x: 0.72,
    y: 0.78,
    w: 0.85,
    h: 0.08,
    line: { color: COLORS.lime, transparency: 100 },
    fill: { color: COLORS.lime },
  });
  if (fs.existsSync(logoPath)) {
    cover.addImage({
      path: logoPath,
      x: 10.05,
      y: 1.04,
      w: 2.2,
      h: 2.2,
    });
  }
  cover.addText("ONE CHITRA", {
    x: 0.72,
    y: 1.1,
    w: 6.6,
    h: 0.48,
    fontSize: 12,
    bold: true,
    color: COLORS.teal,
    margin: 0,
    charSpace: 1,
  });
  cover.addText("Go-Live Presentation", {
    x: 0.72,
    y: 1.68,
    w: 7.4,
    h: 0.9,
    fontSize: 26,
    bold: true,
    color: COLORS.white,
    margin: 0,
  });
  cover.addText("Sistem terintegrasi untuk SCM, sales, logistics, approval, analytics, dan security dengan konektivitas SAP.", {
    x: 0.72,
    y: 2.72,
    w: 7.4,
    h: 1.0,
    fontSize: 15,
    color: "D8E8F6",
    margin: 0,
    fit: "shrink",
  });
  addPill(cover, 0.72, 4.12, 1.8, "SCM & Inventory", COLORS.blue, COLORS.white);
  addPill(cover, 2.72, 4.12, 1.62, "SAP Sync", COLORS.teal, COLORS.white);
  addPill(cover, 4.52, 4.12, 1.86, "Approval & Control", COLORS.lime, COLORS.dark);
  cover.addText("Chitra Paratama | 13 Maret 2026", {
    x: 0.72,
    y: 6.65,
    w: 4.8,
    h: 0.22,
    fontSize: 10.5,
    color: "BFD4E8",
    margin: 0,
  });
  cover.addText("Prepared from the current One Chitra codebase structure", {
    x: 0.72,
    y: 6.98,
    w: 5.8,
    h: 0.18,
    fontSize: 8.5,
    color: "8FB2D2",
    margin: 0,
  });

  const s2 = pptx.addSlide();
  addBase(s2, 2, "Executive Summary", "Ringkasan sistem aktual berdasarkan modul aplikasi, integrasi, dan lapisan data yang ada di repository.");
  addMetricCard(s2, 0.7, 1.58, 2.7, 1.48, "52", "Area dashboard utama", COLORS.blue);
  addMetricCard(s2, 3.58, 1.58, 2.7, 1.48, "40", "Skema data bisnis", COLORS.teal);
  addMetricCard(s2, 6.46, 1.58, 2.7, 1.48, "52", "Server actions operasional", COLORS.lime);
  addMetricCard(s2, 9.34, 1.58, 2.7, 1.48, "21", "File pengujian inti", COLORS.navy);
  addTextBox(
    s2,
    0.7,
    3.42,
    5.9,
    2.02,
    "Nilai utama sistem",
    "One Chitra berfungsi sebagai satu platform operasional yang menghubungkan data SAP, transaksi lokal, aktivitas gudang, pengiriman, costing, approval, dan pelaporan dalam satu antarmuka kerja.",
    COLORS.blue,
  );
  addTextBox(
    s2,
    6.82,
    3.42,
    5.8,
    2.02,
    "Domain bisnis yang dicakup",
    "- SCM management\n- Inventory control\n- Sales and quotation\n- Logistics and cost settlement\n- Approval and security\n- Reporting, forecast, dan ML",
    COLORS.teal,
  );
  addRecommendation(
    s2,
    "Posisi deck ini: sistem sudah memiliki cakupan fungsional yang luas untuk go-live terkontrol, dengan final sign-off tetap bergantung pada validasi UAT, data master, dan role mapping.",
  );

  const s3 = pptx.addSlide();
  addBase(s3, 3, "Cakupan Modul", "Susunan modul diambil dari konfigurasi navigasi dashboard yang aktif di aplikasi.");
  addTextBox(
    s3,
    0.7,
    1.48,
    2.9,
    2.12,
    "SCM Management",
    "- Products & Warehouse\n- Good Receive SAP / Manual\n- Sales Order\n- Deliveries & DO Monitoring\n- Billing\n- Fleet Management\n- Stock Transfer",
    COLORS.blue,
  );
  addTextBox(
    s3,
    3.85,
    1.48,
    2.9,
    2.12,
    "Inventory Control",
    "- Inventory vs SAP\n- Stocks & Stock SAP feed\n- Stock Opname\n- Movement log\n- Reorder alerts\n- Dead stock\n- ML predictions",
    COLORS.teal,
  );
  addTextBox(
    s3,
    7,
    1.48,
    2.9,
    2.12,
    "Business & Analytics",
    "- Customers & segmentation\n- Marketing calendar\n- Competitor info\n- Campaign manager\n- Price management\n- Quotations\n- Sales dashboard",
    COLORS.lime,
  );
  addTextBox(
    s3,
    10.15,
    1.48,
    2.18,
    2.12,
    "Control Layer",
    "- Approval inbox\n- Approval settings\n- Matrix approval\n- Security users\n- Roles & permissions\n- Audit logs\n- Sessions",
    COLORS.navy,
  );
  addTextBox(
    s3,
    0.7,
    4.02,
    5.8,
    1.72,
    "Integrasi pendukung",
    "Sistem juga menyediakan SAP stock feed, SAP sync report, email settings, email delivery logs, upload storage, dan pengaturan navbar untuk administrasi aplikasi.",
    COLORS.navy,
  );
  addTextBox(
    s3,
    6.82,
    4.02,
    5.5,
    1.72,
    "Makna bisnis",
    "Cakupan modul menunjukkan bahwa One Chitra bukan hanya aplikasi transaksi, tetapi platform kerja lintas fungsi dari inbound, inventory, sales, delivery, costing, sampai management reporting.",
    COLORS.warn,
  );

  const s4 = pptx.addSlide();
  addBase(s4, 4, "Alur Operasional End-to-End", "Narasi proses yang relevan untuk presentasi go-live lintas fungsi.");
  addProcessStep(s4, 0.72, 1.42, 3.92, 1.52, 1, "Master data & SAP feed", "Produk, warehouse, stock SAP, dan data revenue menjadi fondasi referensi operasional.", COLORS.blue);
  addProcessStep(s4, 4.7, 1.42, 3.92, 1.52, 2, "Inbound & receiving", "Barang masuk diproses melalui Good Receive SAP atau manual dan direkam ke pergerakan stok.", COLORS.teal);
  addProcessStep(s4, 8.68, 1.42, 3.92, 1.52, 3, "Inventory control", "Tim gudang membandingkan stok lokal vs SAP, menjalankan stock opname, dan memonitor reorder atau dead stock.", COLORS.lime);
  addProcessStep(s4, 0.72, 3.34, 3.92, 1.52, 4, "Sales & fulfillment", "Sales order, quotation, price management, delivery scheduling, DO monitoring, dan fleet dikelola dalam alur yang sama.", COLORS.navy);
  addProcessStep(s4, 4.7, 3.34, 3.92, 1.52, 5, "Billing & settlement", "Billing, delivery cost request, logistics cost, dan cost settlement memberikan penutupan proses finansial operasional.", COLORS.blue);
  addProcessStep(s4, 8.68, 3.34, 3.92, 1.52, 6, "Reporting & decision", "Dashboard, revenue forecast, quotation analysis, ABC analysis, dan ML membantu evaluasi performa dan pengambilan keputusan.", COLORS.teal);
  addRecommendation(
    s4,
    "Pesan kunci saat presentasi: data SAP tidak berhenti di sinkronisasi, tetapi diterjemahkan menjadi aksi operasional harian dan visibilitas manajemen.",
  );

  const s5 = pptx.addSlide();
  addBase(s5, 5, "Arsitektur Sistem & Integrasi", "Lapisan teknologi yang mendukung operasi One Chitra.");
  addLayer(s5, 0.78, 1.34, 11.8, 0.82, "Pengguna", "Warehouse | Sales admin | Logistics | Marketing | Security | Management", "EAF4FB", COLORS.ink);
  addLayer(s5, 1.12, 2.34, 11.12, 0.88, "Experience layer", "Next.js 16 + React 19 dashboard dengan page routing, command shortcuts, report pages, dan module-specific screens.", "DDF1F7", COLORS.ink);
  addLayer(s5, 1.44, 3.42, 10.48, 1.0, "Business service layer", "Server actions, approval engine, RBAC checks, sync logic, export, reporting, cron jobs, and operational workflows.", "EAF8EA", COLORS.ink);
  addLayer(s5, 1.76, 4.66, 9.84, 0.94, "Data layer", "PostgreSQL + Drizzle ORM dengan 40 schema file untuk transaksi, master data, audit, approval, inventory, and analytics.", "EEF2F7", COLORS.ink);
  addLayer(s5, 2.08, 5.84, 9.2, 0.8, "Integration layer", "SAP stock tables, SAP sales revenue, email services, upload storage, monitoring, and Dokploy deployment runtime.", "FFF4E8", COLORS.ink);
  addTextBox(
    s5,
    9.72,
    1.42,
    2.56,
    1.28,
    "Security basis",
    "Better Auth session handling, permission-based access, audit logs, and session monitoring.",
    COLORS.navy,
  );
  addTextBox(
    s5,
    9.72,
    2.96,
    2.56,
    1.28,
    "Integration basis",
    "Feed SAP tersedia untuk stock, good receive, revenue, billing reference, dan sync reporting.",
    COLORS.teal,
  );

  const s6 = pptx.addSlide();
  addBase(s6, 6, "Governance, Security, dan Control", "Kapabilitas kontrol yang penting untuk kesiapan operasional setelah go-live.");
  addTextBox(
    s6,
    0.72,
    1.46,
    4.04,
    2.06,
    "Operational governance",
    "- Approval inbox untuk request operasional\n- Approval settings dan matrix builder\n- Workflow canvas untuk alur approval dinamis\n- Tracking status request dan log keputusan",
    COLORS.blue,
  );
  addTextBox(
    s6,
    4.96,
    1.46,
    4.04,
    2.06,
    "Access governance",
    "- Role-based access control per resource dan action\n- Security overview, users, roles, permissions\n- Session management untuk user aktif\n- Audit logs untuk jejak aktivitas",
    COLORS.teal,
  );
  addTextBox(
    s6,
    9.2,
    1.46,
    3.42,
    2.06,
    "Operational support",
    "- Email settings dan template logs\n- SAP sync report & discrepancy view\n- Navbar settings untuk kontrol menu sesuai kebutuhan organisasi",
    COLORS.lime,
  );
  addTextBox(
    s6,
    0.72,
    3.96,
    5.84,
    1.78,
    "Kenapa penting saat go-live",
    "Saat volume transaksi mulai berjalan, organisasi memerlukan bukan hanya fitur input, tetapi juga otorisasi, jejak audit, penanganan exception, dan monitoring sinkronisasi agar proses tetap terkendali.",
    COLORS.navy,
  );
  addTextBox(
    s6,
    6.82,
    3.96,
    5.8,
    1.78,
    "Pesan untuk stakeholder",
    "One Chitra sudah punya fondasi governance yang cukup matang untuk operasi lintas fungsi, sehingga risiko kerja manual tanpa kontrol dapat ditekan secara signifikan.",
    COLORS.warn,
  );

  const s7 = pptx.addSlide();
  addBase(s7, 7, "Analytics & Decision Support", "One Chitra memadukan transaksi harian dengan insight untuk level supervisor hingga management.");
  addTextBox(
    s7,
    0.72,
    1.52,
    4,
    2.08,
    "Operational dashboards",
    "- Main dashboard overview\n- Sales dashboard\n- Inventory comparison\n- Stock movement dashboard\n- DO monitoring and logistics cost tracking",
    COLORS.blue,
  );
  addTextBox(
    s7,
    4.94,
    1.52,
    4,
    2.08,
    "Advanced analysis",
    "- Revenue vs forecast\n- ML revenue forecast\n- Inventory ML & predictive replenishment\n- ABC analysis\n- Quotation analysis",
    COLORS.teal,
  );
  addTextBox(
    s7,
    9.16,
    1.52,
    3.46,
    2.08,
    "Business insight",
    "- Customer segmentation\n- Competitor intelligence\n- Fleetlist insight\n- History order review\n- R49 dashboard",
    COLORS.lime,
  );
  addTextBox(
    s7,
    0.72,
    4.02,
    5.94,
    1.74,
    "Nilai praktis",
    "Tim operasional bisa menindaklanjuti issue harian, sementara management dapat memantau performa revenue, stock gap, customer movement, dan akurasi forecast dalam platform yang sama.",
    COLORS.navy,
  );
  addTextBox(
    s7,
    6.9,
    4.02,
    5.72,
    1.74,
    "Narasi presentasi",
    "Aplikasi ini layak diposisikan bukan hanya sebagai system of record, tetapi sebagai system of action dan system of insight sekaligus.",
    COLORS.warn,
  );

  const s8 = pptx.addSlide();
  addBase(s8, 8, "Go-Live Readiness", "Ringkasan aspek yang sudah terlihat siap di sistem dan aspek yang tetap perlu dikonfirmasi sebelum cutover.");
  addTextBox(
    s8,
    0.72,
    1.46,
    3.9,
    3.88,
    "Yang sudah tersedia di sistem",
    "- Modul operasional utama lintas fungsi\n- Integrasi SAP untuk stock, GR, revenue, billing reference\n- Approval, security, audit, dan session control\n- Upload persistence guidance untuk deployment Dokploy\n- Report pages untuk discrepancy dan sync issue",
    COLORS.teal,
  );
  addTextBox(
    s8,
    4.82,
    1.46,
    3.9,
    3.88,
    "Yang harus divalidasi sebelum cutover",
    "- UAT final dan sign-off process owner\n- Kualitas master data produk, customer, warehouse\n- Role mapping dan permission matrix user nyata\n- Jadwal sync SAP dan fallback handling\n- Backup, restore, dan ownership hypercare",
    COLORS.warn,
  );
  addTextBox(
    s8,
    8.92,
    1.46,
    3.7,
    3.88,
    "Rekomendasi operating model",
    "- Controlled go-live per fungsi prioritas\n- Daily monitoring untuk sync dan error logs\n- Hypercare 2 minggu pertama\n- SOP incident owner per modul\n- Training singkat per user group",
    COLORS.blue,
  );
  addRecommendation(
    s8,
    "Rekomendasi: lanjutkan ke controlled go-live, bukan big-bang tanpa kontrol. Fokus pada data master, role mapping, hypercare, dan monitoring harian setelah peluncuran.",
  );

  const s9 = pptx.addSlide();
  addBase(s9, 9, "Business Impact & Next Steps", "Ringkasan manfaat yang dapat dibawa ke presentasi penutup.");
  addTextBox(
    s9,
    0.72,
    1.46,
    5.88,
    3.18,
    "Dampak bisnis yang diharapkan",
    "- Satu sumber kerja untuk tim gudang, sales, logistics, dan management\n- Pengurangan perpindahan data manual antar proses\n- Visibilitas lebih cepat atas gap stock, delivery, costing, dan revenue\n- Peningkatan akuntabilitas lewat approval, audit, dan role control\n- Fondasi yang lebih kuat untuk scale-up analytics dan automation",
    COLORS.blue,
  );
  addTextBox(
    s9,
    6.86,
    1.46,
    5.74,
    3.18,
    "Langkah berikutnya",
    "1. Final check UAT, data, dan user mapping\n2. Training singkat per fungsi\n3. Cutover dengan owner yang jelas\n4. Monitor hypercare harian\n5. Tutup temuan awal dan lanjutkan improvement phase",
    COLORS.teal,
  );
  slideClosingBanner(s9);
}

async function main() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  buildSlides();
  await pptx.writeFile({ fileName: outputFile });
  console.log(`Generated: ${outputFile}`);
}

main().catch((error) => {
  console.error("Failed to generate presentation:", error);
  process.exit(1);
});
