import { layers, grid, panel, shape, text, textStyle, stroke, fr, fixed } from "@oai/artifact-tool";

const C = {
  ink: "#17212B", slate: "#425466", muted: "#64748B", line: "#CFD8E3",
  paper: "#F7F3EA", white: "#FFFFFF", red: "#D83B3B", blue: "#2868A8",
  green: "#1E7F5C", amber: "#B7791F", violet: "#6B4E9B", charcoal: "#24313D",
};

const label = (value, x, y, w, h, size = 13, color = C.ink, weight = "semibold") =>
  text(value, { position: { x, y }, width: w, height: h, style: textStyle(`font: ${weight} ${size}px Aptos; color: ${color}; leading: 1.05; anchor: middle; wrap: square; inset: 0 2 0 2`) });

const small = (value, x, y, w, h, color = C.muted) =>
  text(value, { position: { x, y }, width: w, height: h, style: textStyle(`font: 10px Aptos; color: ${color}; leading: 1.15; anchor: middle; wrap: square; inset: 0 2 0 2`) });

const node = ({ name, title, body, x, y, w, h, accent, fill = C.white }) =>
  layers({ name, position: { x, y }, width: w, height: h }, [
    shape({ name: `${name}-box`, width: w, height: h, fill, line: stroke(`1px solid ${C.line}`), borderRadius: 8 }),
    shape({ name: `${name}-bar`, position: { x: 0, y: 0 }, width: 7, height: h, fill: accent, line: stroke("none"), borderRadius: 8 }),
    text(title, { name: `${name}-title`, position: { x: 18, y: 13 }, width: w - 28, height: 20, style: textStyle(`font: bold 15px Aptos; color: ${C.ink}; leading: 1; wrap: square; inset: 0`) }),
    text(body, { name: `${name}-body`, position: { x: 18, y: 39 }, width: w - 28, height: h - 48, style: textStyle(`font: 10.5px Aptos; color: ${C.slate}; leading: 1.12; wrap: square; inset: 0`) }),
  ]);

const chip = (value, x, y, color) =>
  layers({ position: { x, y }, width: 128, height: 24 }, [
    shape({ width: 128, height: 24, fill: "#F9FBFC", line: stroke(`1px solid ${color}`), borderRadius: 12 }),
    label(value, 0, 3, 128, 18, 10, C.charcoal, "semibold"),
  ]);

export async function slide01(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;

  slide.compose(layers({ width: 1280, height: 720 }, [
    shape({ position: { x: 24, y: 24 }, width: 1232, height: 672, fill: C.paper, line: stroke("none") }),
    text("ONE CHITRA", { position: { x: 44, y: 35 }, width: 140, height: 20, style: textStyle(`font: bold 13px Aptos; color: ${C.red}; leading: 1; anchor: middle; inset: 0`) }),
    text("Peta Besar Fitur dan Hubungan Sistem", { position: { x: 44, y: 62 }, width: 540, height: 48, style: textStyle(`font: bold 34px Aptos Display; color: ${C.ink}; leading: 0.95; wrap: square; inset: 0`) }),
    text("Platform operasional terintegrasi: demand, sales, SCM, inventory, fleet, finance, approval, analytics, dan admin berjalan dalam satu loop data.", { position: { x: 44, y: 118 }, width: 505, height: 42, style: textStyle(`font: 14px Aptos; color: ${C.slate}; leading: 1.15; wrap: square; inset: 0`) }),

    panel({ position: { x: 44, y: 184 }, width: 225, height: 420, fill: "#FFFDF7", line: stroke(`1px solid ${C.line}`), borderRadius: 10, padding: 18 },
      grid({ width: 189, columns: [fr(1)], rows: [fixed(28), fixed(58), fixed(58), fixed(58), fixed(58), fixed(58)], rowGap: 11 }, [
        label("Layer Sistem", 0, 0, 189, 24, 14, C.ink, "bold"),
        node({ name: "layer-main", title: "Main", body: "Dashboard, Portal", x: 0, y: 0, w: 189, h: 58, accent: C.red }),
        node({ name: "layer-scm", title: "SCM", body: "Master data, receive, outbound, stock, logistics", x: 0, y: 0, w: 189, h: 58, accent: C.green }),
        node({ name: "layer-business", title: "Business", body: "Marketing, sales, customer, reports, forecast", x: 0, y: 0, w: 189, h: 58, accent: C.blue }),
        node({ name: "layer-control", title: "Control", body: "Approval inbox, settings, matrix", x: 0, y: 0, w: 189, h: 58, accent: C.amber }),
        node({ name: "layer-admin", title: "System", body: "Security, SAP sync, navbar, activity log", x: 0, y: 0, w: 189, h: 58, accent: C.violet }),
      ])
    ),

    shape({ name: "hub-ring", position: { x: 515, y: 246 }, width: 250, height: 250, geometry: "ellipse", fill: "#FFFFFF", line: stroke(`2px solid ${C.ink}`) }),
    shape({ name: "hub-core", position: { x: 543, y: 274 }, width: 194, height: 194, geometry: "ellipse", fill: C.charcoal, line: stroke("none") }),
    text("ONE CHITRA\nOPERATING\nSYSTEM", { name: "hub-title", position: { x: 570, y: 318 }, width: 140, height: 80, style: textStyle(`font: bold 25px Aptos Display; color: #FFFFFF; leading: 0.9; align: center; anchor: middle; wrap: square; inset: 0`) }),
    small("single source of truth + workflow control", 558, 406, 164, 28, "#DDE7F0"),

    node({ name: "demand", title: "Demand & Market", body: "Campaign Manager, Instagram Generator, Email Lists, Calendar, Forms, Customer Tire History, A2R Competition", x: 318, y: 184, w: 226, h: 112, accent: C.blue }),
    node({ name: "sales", title: "Sales & Customer", body: "Quotations, Sales Dashboard, GP Campaign, Competitor, Top Customer, Customer 360, Segmentation, Sales Documents", x: 736, y: 184, w: 242, h: 112, accent: C.red }),
    node({ name: "scm", title: "SCM Execution", body: "Products, Bundling, Warehouse, Good Receive SAP/Manual, EPR, Vendor Quotation, Sales Order, Delivery, DO Monitoring, Billing", x: 304, y: 516, w: 280, h: 118, accent: C.green }),
    node({ name: "inventory", title: "Inventory Intelligence", body: "Inventory, Stock, Stock Card, SAP Stock, Opname, Movement Log, Reorder Alerts, Dead Stock, Safety Stock ML, Procurement Next", x: 690, y: 516, w: 292, h: 118, accent: C.green }),
    node({ name: "fleet", title: "Fleet, Logistics & Cost", body: "Fleet Management, Fleetlist, Delivery Planning Board, Stock Transfer, E-VHS, Serial History, Logistic Cost Log, Master Price, Cost Fuel", x: 884, y: 332, w: 250, h: 128, accent: C.amber }),
    node({ name: "services", title: "Central Services", body: "WIP Repair Dashboard, WIP Repair Table, Master Barang Repair", x: 146, y: 516, w: 136, h: 118, accent: C.violet }),
    node({ name: "approval", title: "Approval & Governance", body: "Approval Inbox, Approval Settings, Matrix Approval, Security, Users, Roles, Sessions, Audit Trail", x: 146, y: 332, w: 154, h: 128, accent: C.amber }),
    node({ name: "system", title: "Admin & Integration", body: "SAP Stock Feed, SAP Sync Report, Navbar Settings, Knowledge Chitra Jenius, Operational Activity Log", x: 998, y: 184, w: 192, h: 112, accent: C.violet }),


    shape({ position: { x: 544, y: 238 }, width: 192, height: 4, fill: C.red, line: stroke("none") }),
    shape({ position: { x: 431, y: 328 }, width: 84, height: 4, fill: C.blue, line: stroke("none") }),
    shape({ position: { x: 610, y: 468 }, width: 4, height: 48, fill: C.green, line: stroke("none") }),
    shape({ position: { x: 584, y: 573 }, width: 106, height: 4, fill: C.green, line: stroke("none") }),
    shape({ position: { x: 765, y: 393 }, width: 119, height: 4, fill: C.amber, line: stroke("none") }),
    shape({ position: { x: 300, y: 394 }, width: 215, height: 4, fill: C.amber, line: stroke("none") }),
    shape({ position: { x: 974, y: 238 }, width: 24, height: 4, fill: C.violet, line: stroke("none") }),
    shape({ position: { x: 638, y: 184 }, width: 4, height: 62, fill: C.blue, line: stroke("none") }),

    panel({ position: { x: 1044, y: 516 }, width: 164, height: 118, fill: "#FFFDF7", line: stroke(`1px solid ${C.line}`), borderRadius: 10, padding: 13 },
      grid({ width: 138, columns: [fr(1)], rows: [fixed(22), fixed(20), fixed(20), fixed(20), fixed(20)], rowGap: 4 }, [
        label("Business Goals", 0, 0, 138, 20, 13, C.ink, "bold"),
        small("visibility end-to-end", 0, 0, 138, 18, C.slate),
        small("faster fulfillment", 0, 0, 138, 18, C.slate),
        small("controlled approval", 0, 0, 138, 18, C.slate),
        small("forecast + margin insight", 0, 0, 138, 18, C.slate),
      ])
    ),

    chip("Reports Hub", 574, 166, C.blue), chip("Sales Revenue", 706, 166, C.blue), chip("ML Forecast", 838, 166, C.blue),
    chip("ABC Analysis", 574, 637, C.green), chip("Quotation Analysis", 706, 637, C.green), chip("R49 Tire", 838, 637, C.green),
    text("Sumber fitur: navigationConfig + dashboard routes. Semua modul ditempatkan sebagai alur kerja yang saling memberi data, kontrol, dan insight.", { position: { x: 44, y: 660 }, width: 930, height: 18, style: textStyle(`font: 9px Aptos; color: ${C.muted}; leading: 1; inset: 0`) }),
  ]));

  return slide;
}



