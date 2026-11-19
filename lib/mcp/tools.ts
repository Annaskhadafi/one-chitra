import { db } from "@/db";
import {
    products,
    stockLevels,
    warehouses,
    customers,
    quotations,
    quotationItems,
    salesOrders,
    salesOrderItems,
    user,
    quotationApprovalProgress,
    deliveries,
    whatsappRegisteredNumbers,
} from "@/db/schema";
import { eq, ilike, or, and, sql, desc, gte, lte } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface StockCheckResult {
    found: boolean;
    query: string;
    totalAvailable: number;
    items: Array<{
        productId: number;
        materialNumber: string;
        description: string;
        brand: string | null;
        category: string;
        warehouseName: string;
        warehouseCode?: string;
        totalStock: number;
        bookedStock: number;
        availableStock: number;
        costSap?: string | null;
    }>;
}

/**
 * 1. Check Stock Inventory across warehouses
 */
export async function checkStockInventory(params: {
    query?: string;
    warehouseName?: string;
    lowStockOnly?: boolean;
    limit?: number;
}): Promise<StockCheckResult> {
    const query = params.query?.trim() || "";
    const limit = params.limit || 15;

    let conditions: any[] = [];

    if (query) {
        conditions.push(
            or(
                ilike(products.materialDescription, `%${query}%`),
                ilike(products.materialNumber, `%${query}%`),
                ilike(products.brand, `%${query}%`),
                ilike(products.category, `%${query}%`)
            )
        );
    }

    if (params.warehouseName) {
        conditions.push(
            or(
                ilike(warehouses.description, `%${params.warehouseName}%`),
                ilike(warehouses.sloc, `%${params.warehouseName}%`)
            )
        );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
        .select({
            productId: products.id,
            materialNumber: products.materialNumber,
            description: products.materialDescription,
            brand: products.brand,
            category: products.category,
            costSap: products.costSap,
            warehouseId: warehouses.id,
            warehouseDescription: warehouses.description,
            warehouseSloc: warehouses.sloc,
            totalStock: stockLevels.totalStock,
            bookedStock: stockLevels.bookedStock,
            draftBookedStock: stockLevels.draftBookedStock,
            minStock: stockLevels.minStock,
        })
        .from(stockLevels)
        .innerJoin(products, eq(stockLevels.productId, products.id))
        .innerJoin(warehouses, eq(stockLevels.warehouseId, warehouses.id))
        .where(whereClause)
        .limit(limit);

    const items = rows.map((r) => {
        const available = Math.max(0, (r.totalStock || 0) - (r.bookedStock || 0) - (r.draftBookedStock || 0));
        return {
            productId: r.productId,
            materialNumber: r.materialNumber,
            description: r.description || "N/A",
            brand: r.brand,
            category: r.category,
            warehouseName: r.warehouseDescription || r.warehouseSloc,
            warehouseCode: r.warehouseSloc || undefined,
            totalStock: r.totalStock || 0,
            bookedStock: r.bookedStock || 0,
            availableStock: available,
            costSap: r.costSap,
        };
    });

    const totalAvailable = items.reduce((acc, curr) => acc + curr.availableStock, 0);

    return {
        found: items.length > 0,
        query,
        totalAvailable,
        items,
    };
}

/**
 * 2. Get Revenue & Sales Summary (Finansial)
 */
export async function getRevenueSummary(params: {
    period?: "today" | "this_month" | "this_year" | "custom";
    startDate?: string;
    endDate?: string;
}): Promise<{
    period: string;
    totalOrders: number;
    totalRevenue: number;
    formattedRevenue: string;
    topCustomers: Array<{ customerName: string; totalAmount: number }>;
    recentOrders: Array<{ invoiceNumber: string | null; date: string; customerName: string; total: number; status: string }>;
}> {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), 1); // awal bulan
    let end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    if (params.period === "today") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (params.period === "this_year") {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else if (params.period === "custom" && params.startDate && params.endDate) {
        start = new Date(params.startDate);
        end = new Date(params.endDate);
    }

    // Ambil order dalam range
    const orders = await db
        .select({
            id: salesOrders.id,
            invoiceNumber: salesOrders.invoiceNumber,
            salesDate: salesOrders.salesDate,
            status: salesOrders.status,
            customerName: customers.name,
        })
        .from(salesOrders)
        .leftJoin(customers, eq(salesOrders.customerId, customers.id))
        .where(and(gte(salesOrders.salesDate, start), lte(salesOrders.salesDate, end)))
        .orderBy(desc(salesOrders.salesDate))
        .limit(100);

    const orderIds = orders.map((o) => o.id);
    let totalRevenue = 0;
    const customerTotals: Record<string, number> = {};
    const orderAmounts: Record<number, number> = {};

    if (orderIds.length > 0) {
        const items = await db
            .select({
                salesOrderId: salesOrderItems.salesOrderId,
                quantity: salesOrderItems.quantity,
                unitPrice: salesOrderItems.unitPrice,
                discount: salesOrderItems.discount,
            })
            .from(salesOrderItems)
            .where(sql`${salesOrderItems.salesOrderId} IN ${orderIds}`);

        for (const it of items) {
            const qty = it.quantity || 1;
            const price = Number(it.unitPrice) || 0;
            const disc = Number(it.discount) || 0;
            const lineTotal = Math.max(0, qty * price - disc);

            totalRevenue += lineTotal;
            orderAmounts[it.salesOrderId] = (orderAmounts[it.salesOrderId] || 0) + lineTotal;
        }

        for (const ord of orders) {
            const cName = ord.customerName || "Customer Umum";
            const amt = orderAmounts[ord.id] || 0;
            customerTotals[cName] = (customerTotals[cName] || 0) + amt;
        }
    }

    const topCustomers = Object.entries(customerTotals)
        .map(([customerName, totalAmount]) => ({ customerName, totalAmount }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 5);

    const recentOrders = orders.slice(0, 5).map((o) => ({
        invoiceNumber: o.invoiceNumber,
        date: o.salesDate.toISOString().split("T")[0],
        customerName: o.customerName || "Unknown",
        total: orderAmounts[o.id] || 0,
        status: o.status,
    }));

    return {
        period: params.period || "this_month",
        totalOrders: orders.length,
        totalRevenue,
        formattedRevenue: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(totalRevenue),
        topCustomers,
        recentOrders,
    };
}

/**
 * 3. Create Sales Quotation
 */
export async function createSalesQuotation(params: {
    customerName: string;
    items: Array<{
        productQuery: string;
        quantity: number;
        unitPrice?: number;
    }>;
    clientNote?: string;
    salesPersonId?: string;
    validUntilDays?: number;
}): Promise<{
    success: boolean;
    quotationId: number;
    quotationNumber: string;
    customerName: string;
    totalAmount: number;
    formattedTotal: string;
    itemCount: number;
    items: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
    }>;
}> {
    // 1. Cari atau buat customer
    let customer = await db
        .select()
        .from(customers)
        .where(ilike(customers.name, `%${params.customerName.trim()}%`))
        .limit(1)
        .then((res) => res[0]);

    if (!customer) {
        // Buat customer baru
        const customerCode = `CUST-${Date.now().toString(36).toUpperCase()}`;
        const insertedCust = await db
            .insert(customers)
            .values({
                customerCode,
                name: params.customerName.trim(),
            })
            .returning();
        customer = insertedCust[0];
    }

    // 2. Generate Nomor Quotation
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const countRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(quotations)
        .where(sql`EXTRACT(YEAR FROM ${quotations.quotationDate}) = ${year}`);
    const seq = Number(countRes[0]?.count || 0) + 1;
    const quotationNumber = `QUO/${year}/${month}/${String(seq).padStart(4, "0")}`;

    const validUntil = new Date(now.getTime() + (params.validUntilDays || 14) * 24 * 60 * 60 * 1000);

    // 3. Match item produk
    const createdItems: Array<{
        productId: number | null;
        description: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
    }> = [];

    let grandTotal = 0;

    for (const it of params.items) {
        const prod = await db
            .select()
            .from(products)
            .where(
                or(
                    ilike(products.materialDescription, `%${it.productQuery}%`),
                    ilike(products.materialNumber, `%${it.productQuery}%`)
                )
            )
            .limit(1)
            .then((res) => res[0]);

        const descText = prod ? `${prod.materialNumber} - ${prod.materialDescription}` : it.productQuery;
        // Gunakan price dari input atau costSap jika tersedia
        let price = it.unitPrice || 0;
        if (!price && prod?.costSap) {
            price = parseFloat(prod.costSap.replace(/[^0-9.]/g, "")) || 0;
        }
        if (!price) {
            price = 1000000; // default placeholder jika belum ditentukan
        }

        const qty = it.quantity || 1;
        const subtotal = qty * price;
        grandTotal += subtotal;

        createdItems.push({
            productId: prod ? prod.id : null,
            description: descText,
            quantity: qty,
            unitPrice: price,
            subtotal,
        });
    }

    // 4. Resolve Creator User
    let creatorId = params.salesPersonId;
    if (!creatorId) {
        const firstUser = await db.select({ id: user.id }).from(user).limit(1).then((r) => r[0]);
        creatorId = firstUser?.id;
    }

    // 5. Insert Quotation
    const [newQuotation] = await db
        .insert(quotations)
        .values({
            quotationNumber,
            customerId: customer.id,
            quotationDate: now,
            validUntil,
            status: "draft",
            currency: "IDR",
            discount: "0",
            tax: "0",
            shipping: "0",
            clientNote: params.clientNote || "Dibuat otomatis via WhatsApp AI Bot ONE-CHITRA",
            salesPersonId: creatorId || null,
            createdBy: creatorId!,
        })
        .returning();

    // 5. Insert Quotation Items
    for (const it of createdItems) {
        await db.insert(quotationItems).values({
            quotationId: newQuotation.id,
            productId: it.productId,
            description: it.description,
            quantity: it.quantity,
            unitPrice: String(it.unitPrice),
            discount: "0",
            tax: "0",
        });
    }

    return {
        success: true,
        quotationId: newQuotation.id,
        quotationNumber,
        customerName: customer.name,
        totalAmount: grandTotal,
        formattedTotal: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(grandTotal),
        itemCount: createdItems.length,
        items: createdItems,
    };
}

/**
 * 4. Generate Official PDF Quotation Buffer
 */
export async function generateQuotationPdfBuffer(quotationId: number): Promise<{
    buffer: Buffer;
    fileName: string;
}> {
    const [quo] = await db
        .select({
            id: quotations.id,
            quotationNumber: quotations.quotationNumber,
            quotationDate: quotations.quotationDate,
            validUntil: quotations.validUntil,
            clientNote: quotations.clientNote,
            customerName: customers.name,
        })
        .from(quotations)
        .leftJoin(customers, eq(quotations.customerId, customers.id))
        .where(eq(quotations.id, quotationId));

    if (!quo) {
        throw new Error(`Quotation #${quotationId} tidak ditemukan.`);
    }

    const items = await db
        .select()
        .from(quotationItems)
        .where(eq(quotationItems.quotationId, quotationId));

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Header ONE-CHITRA
    page.drawText("PT CHITRA PARATAMA", {
        x: 40,
        y: height - 50,
        size: 18,
        font: fontBold,
        color: rgb(0.08, 0.25, 0.45),
    });
    page.drawText("OFFICIAL SALES QUOTATION", {
        x: 40,
        y: height - 70,
        size: 12,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
    });

    page.drawLine({
        start: { x: 40, y: height - 80 },
        end: { x: width - 40, y: height - 80 },
        thickness: 1.5,
        color: rgb(0.08, 0.25, 0.45),
    });

    // Info Dokumen
    let yPos = height - 105;
    page.drawText(`Nomor Penawaran : ${quo.quotationNumber || "-"}`, { x: 40, y: yPos, size: 10, font: fontBold });
    page.drawText(`Kepada : ${quo.customerName || "-"}`, { x: width / 2, y: yPos, size: 10, font: fontBold });

    yPos -= 18;
    const dateStr = quo.quotationDate ? new Date(quo.quotationDate).toLocaleDateString("id-ID") : "-";
    const validStr = quo.validUntil ? new Date(quo.validUntil).toLocaleDateString("id-ID") : "-";
    page.drawText(`Tanggal         : ${dateStr}`, { x: 40, y: yPos, size: 10, font: fontRegular });
    page.drawText(`Berlaku Sampai : ${validStr}`, { x: width / 2, y: yPos, size: 10, font: fontRegular });

    // Table Header
    yPos -= 35;
    page.drawRectangle({
        x: 40,
        y: yPos - 5,
        width: width - 80,
        height: 22,
        color: rgb(0.9, 0.94, 0.98),
    });

    page.drawText("No", { x: 45, y: yPos, size: 9, font: fontBold });
    page.drawText("Deskripsi Barang / Part Number", { x: 75, y: yPos, size: 9, font: fontBold });
    page.drawText("Qty", { x: 330, y: yPos, size: 9, font: fontBold });
    page.drawText("Harga Satuan (IDR)", { x: 375, y: yPos, size: 9, font: fontBold });
    page.drawText("Subtotal (IDR)", { x: 475, y: yPos, size: 9, font: fontBold });

    yPos -= 22;
    let totalAll = 0;

    items.forEach((it, idx) => {
        const qty = it.quantity || 1;
        const price = Number(it.unitPrice) || 0;
        const subtotal = qty * price;
        totalAll += subtotal;

        page.drawText(String(idx + 1), { x: 45, y: yPos, size: 8.5, font: fontRegular });
        const descClean = (it.description || "Barang").substring(0, 45);
        page.drawText(descClean, { x: 75, y: yPos, size: 8.5, font: fontRegular });
        page.drawText(String(qty), { x: 335, y: yPos, size: 8.5, font: fontRegular });
        page.drawText(new Intl.NumberFormat("id-ID").format(price), { x: 375, y: yPos, size: 8.5, font: fontRegular });
        page.drawText(new Intl.NumberFormat("id-ID").format(subtotal), { x: 475, y: yPos, size: 8.5, font: fontRegular });

        yPos -= 18;
    });

    // Garis Penutup Tabel
    page.drawLine({
        start: { x: 40, y: yPos + 8 },
        end: { x: width - 40, y: yPos + 8 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
    });

    // Total
    yPos -= 10;
    page.drawText("TOTAL NILAI PENAWARAN :", { x: 310, y: yPos, size: 10, font: fontBold });
    page.drawText(`IDR ${new Intl.NumberFormat("id-ID").format(totalAll)}`, {
        x: 460,
        y: yPos,
        size: 10,
        font: fontBold,
        color: rgb(0.08, 0.25, 0.45),
    });

    // Notes
    yPos -= 40;
    page.drawText("Catatan & Syarat Ketentuan:", { x: 40, y: yPos, size: 9, font: fontBold });
    yPos -= 14;
    page.drawText(quo.clientNote || "- Harga belum termasuk PPN 11% kecuali disebutkan lain.", {
        x: 40,
        y: yPos,
        size: 8.5,
        font: fontRegular,
    });
    yPos -= 14;
    page.drawText("- Waktu pengiriman dan ketersediaan stok dapat berubah sewaktu-waktu.", {
        x: 40,
        y: yPos,
        size: 8.5,
        font: fontRegular,
    });

    // Signature
    yPos -= 60;
    page.drawText("Hormat Kami,", { x: width - 180, y: yPos, size: 9, font: fontRegular });
    page.drawText("PT CHITRA PARATAMA", { x: width - 180, y: yPos - 14, size: 9, font: fontBold });
    page.drawText("( Sales Department )", { x: width - 180, y: yPos - 60, size: 8.5, font: fontRegular });

    const pdfBytes = await pdfDoc.save();
    const fileName = `Quotation_${(quo.quotationNumber || `QUO-${quotationId}`).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

    return {
        buffer: Buffer.from(pdfBytes),
        fileName,
    };
}

/**
 * 5. Get Pending Approvals for a User / Role
 */
export async function getPendingApprovals(params: {
    userId?: string;
    phoneNumber?: string;
    role?: string;
}): Promise<{
    count: number;
    items: Array<{
        progressId: number;
        quotationId: number;
        quotationNumber: string;
        customerName: string;
        stepRole: string;
        stepLabel: string;
        requiredByMargin: string | null;
        totalAmount: number;
        formattedTotal: string;
        createdAt: string;
    }>;
}> {
    let targetUserId = params.userId;

    if (!targetUserId && params.phoneNumber) {
        const cleaned = params.phoneNumber.replace(/[^0-9]/g, "");
        const reg = await db
            .select()
            .from(whatsappRegisteredNumbers)
            .where(
                or(
                    eq(whatsappRegisteredNumbers.phoneNumber, cleaned),
                    eq(whatsappRegisteredNumbers.phoneNumber, `62${cleaned.replace(/^0/, "")}`)
                )
            )
            .limit(1)
            .then((r) => r[0]);
        targetUserId = reg?.userId || undefined;
    }

    const conditions = [eq(quotationApprovalProgress.status, "pending")];
    if (targetUserId) {
        conditions.push(eq(quotationApprovalProgress.assignedUserId, targetUserId));
    }

    const rows = await db
        .select({
            progressId: quotationApprovalProgress.id,
            quotationId: quotationApprovalProgress.quotationId,
            stepRole: quotationApprovalProgress.stepRole,
            stepLabel: quotationApprovalProgress.stepLabel,
            requiredByMargin: quotationApprovalProgress.requiredByMargin,
            createdAt: quotationApprovalProgress.createdAt,
            quotationNumber: quotations.quotationNumber,
            customerId: quotations.customerId,
            customerName: customers.name,
        })
        .from(quotationApprovalProgress)
        .innerJoin(quotations, eq(quotationApprovalProgress.quotationId, quotations.id))
        .leftJoin(customers, eq(quotations.customerId, customers.id))
        .where(and(...conditions))
        .orderBy(desc(quotationApprovalProgress.createdAt))
        .limit(20);

    const items = [];
    for (const r of rows) {
        const qItems = await db
            .select({
                quantity: quotationItems.quantity,
                unitPrice: quotationItems.unitPrice,
                discount: quotationItems.discount,
            })
            .from(quotationItems)
            .where(eq(quotationItems.quotationId, r.quotationId));

        let total = 0;
        for (const qi of qItems) {
            const qty = qi.quantity || 1;
            const price = Number(qi.unitPrice) || 0;
            const disc = Number(qi.discount) || 0;
            total += Math.max(0, qty * price - disc);
        }

        items.push({
            progressId: r.progressId,
            quotationId: r.quotationId,
            quotationNumber: r.quotationNumber || `QUO-${r.quotationId}`,
            customerName: r.customerName || "Customer",
            stepRole: r.stepRole,
            stepLabel: r.stepLabel,
            requiredByMargin: r.requiredByMargin ? `${Number(r.requiredByMargin).toFixed(1)}%` : null,
            totalAmount: total,
            formattedTotal: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(total),
            createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString("id-ID") : "-",
        });
    }

    return {
        count: items.length,
        items,
    };
}

/**
 * 6. Get Quotation Detail & Margin
 */
export async function getQuotationDetail(params: { quotationQuery: string }): Promise<{
    found: boolean;
    quotation?: {
        id: number;
        quotationNumber: string;
        customerName: string;
        salesPersonName: string;
        quotationDate: string;
        validUntil: string;
        status: string;
        clientNote: string | null;
        totalAmount: number;
        formattedTotal: string;
        estimatedMarginPct: number;
        items: Array<{
            productName: string;
            quantity: number;
            unitPrice: number;
            subtotal: number;
        }>;
        approvalSteps: Array<{
            stepLabel: string;
            status: string;
            assigneeName: string;
            actedAt: string | null;
            comment: string | null;
        }>;
    };
}> {
    const qStr = params.quotationQuery.trim();
    const isNum = !isNaN(Number(qStr));

    const [quo] = await db
        .select({
            id: quotations.id,
            quotationNumber: quotations.quotationNumber,
            quotationDate: quotations.quotationDate,
            validUntil: quotations.validUntil,
            status: quotations.status,
            clientNote: quotations.clientNote,
            customerName: customers.name,
            salesPersonId: quotations.salesPersonId,
        })
        .from(quotations)
        .leftJoin(customers, eq(quotations.customerId, customers.id))
        .where(
            or(
                ilike(quotations.quotationNumber, `%${qStr}%`),
                ...(isNum ? [eq(quotations.id, Number(qStr))] : [])
            )
        )
        .limit(1);

    if (!quo) {
        return { found: false };
    }

    // Sales person name
    let salesName = "-";
    if (quo.salesPersonId) {
        const u = await db.select({ name: user.name }).from(user).where(eq(user.id, quo.salesPersonId)).limit(1).then((r) => r[0]);
        salesName = u?.name || "-";
    }

    // Items
    const items = await db
        .select({
            description: quotationItems.description,
            quantity: quotationItems.quantity,
            unitPrice: quotationItems.unitPrice,
            discount: quotationItems.discount,
            productId: quotationItems.productId,
        })
        .from(quotationItems)
        .where(eq(quotationItems.quotationId, quo.id));

    let grandTotal = 0;
    let totalCost = 0;

    const formattedItems = [];
    for (const it of items) {
        const qty = it.quantity || 1;
        const price = Number(it.unitPrice) || 0;
        const subtotal = qty * price;
        grandTotal += subtotal;

        // Cek cost SAP untuk estimasi margin
        if (it.productId) {
            const prod = await db.select({ costSap: products.costSap }).from(products).where(eq(products.id, it.productId)).limit(1).then((r) => r[0]);
            const cost = Number(prod?.costSap?.replace(/[^0-9.]/g, "")) || price * 0.85;
            totalCost += cost * qty;
        } else {
            totalCost += price * 0.85 * qty;
        }

        formattedItems.push({
            productName: it.description || "Produk",
            quantity: qty,
            unitPrice: price,
            subtotal,
        });
    }

    const marginPct = grandTotal > 0 ? ((grandTotal - totalCost) / grandTotal) * 100 : 0;

    // Approval Steps Progress
    const steps = await db
        .select({
            stepLabel: quotationApprovalProgress.stepLabel,
            status: quotationApprovalProgress.status,
            actedAt: quotationApprovalProgress.actedAt,
            comment: quotationApprovalProgress.comment,
            assigneeId: quotationApprovalProgress.assignedUserId,
        })
        .from(quotationApprovalProgress)
        .where(eq(quotationApprovalProgress.quotationId, quo.id))
        .orderBy(quotationApprovalProgress.stepOrder);

    const formattedSteps = [];
    for (const s of steps) {
        let assigneeName = "Staff";
        if (s.assigneeId) {
            const u = await db.select({ name: user.name }).from(user).where(eq(user.id, s.assigneeId)).limit(1).then((r) => r[0]);
            assigneeName = u?.name || "Staff";
        }
        formattedSteps.push({
            stepLabel: s.stepLabel,
            status: s.status,
            assigneeName,
            actedAt: s.actedAt ? new Date(s.actedAt).toLocaleString("id-ID") : null,
            comment: s.comment,
        });
    }

    return {
        found: true,
        quotation: {
            id: quo.id,
            quotationNumber: quo.quotationNumber || `QUO-${quo.id}`,
            customerName: quo.customerName || "Customer",
            salesPersonName: salesName,
            quotationDate: quo.quotationDate ? new Date(quo.quotationDate).toLocaleDateString("id-ID") : "-",
            validUntil: quo.validUntil ? new Date(quo.validUntil).toLocaleDateString("id-ID") : "-",
            status: quo.status,
            clientNote: quo.clientNote,
            totalAmount: grandTotal,
            formattedTotal: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(grandTotal),
            estimatedMarginPct: Number(marginPct.toFixed(1)),
            items: formattedItems,
            approvalSteps: formattedSteps,
        },
    };
}

/**
 * 7. Get Customer Information & Purchase History
 */
export async function getCustomerInfo(params: { query: string }): Promise<{
    found: boolean;
    customer?: {
        id: number;
        customerCode: string;
        name: string;
        contactName: string | null;
        email: string | null;
        address: string | null;
        totalOrdersCount: number;
        recentOrders: Array<{
            invoiceNumber: string | null;
            date: string;
            totalAmount: string;
            status: string;
        }>;
    };
}> {
    const qStr = params.query.trim();

    const [c] = await db
        .select()
        .from(customers)
        .where(or(ilike(customers.name, `%${qStr}%`), ilike(customers.customerCode, `%${qStr}%`)))
        .limit(1);

    if (!c) return { found: false };

    // Ambil order history
    const orders = await db
        .select({
            id: salesOrders.id,
            invoiceNumber: salesOrders.invoiceNumber,
            salesDate: salesOrders.salesDate,
            status: salesOrders.status,
        })
        .from(salesOrders)
        .where(eq(salesOrders.customerId, c.id))
        .orderBy(desc(salesOrders.salesDate))
        .limit(5);

    const recentOrders = [];
    for (const o of orders) {
        const soItems = await db
            .select({
                quantity: salesOrderItems.quantity,
                unitPrice: salesOrderItems.unitPrice,
                discount: salesOrderItems.discount,
            })
            .from(salesOrderItems)
            .where(eq(salesOrderItems.salesOrderId, o.id));

        const total = soItems.reduce((acc, curr) => acc + (curr.quantity * Number(curr.unitPrice) - Number(curr.discount)), 0);

        recentOrders.push({
            invoiceNumber: o.invoiceNumber || `SO-${o.id}`,
            date: o.salesDate ? new Date(o.salesDate).toLocaleDateString("id-ID") : "-",
            totalAmount: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(total),
            status: o.status,
        });
    }

    return {
        found: true,
        customer: {
            id: c.id,
            customerCode: c.customerCode,
            name: c.name,
            contactName: c.contactName,
            email: c.email,
            address: c.address1 || "-",
            totalOrdersCount: orders.length,
            recentOrders,
        },
    };
}

/**
 * 8. Get Delivery / DO Status
 */
export async function getDeliveryStatus(params: { query: string }): Promise<{
    found: boolean;
    delivery?: {
        id: number;
        deliveryNumber: string | null;
        doSap: string | null;
        status: string;
        scheduledDate: string;
        deliveryDate: string | null;
        driverName: string | null;
        vehicleNumber: string | null;
        vehicleType: string | null;
        destination: string | null;
        notes: string | null;
    };
}> {
    const qStr = params.query.trim();

    const [d] = await db
        .select()
        .from(deliveries)
        .where(
            or(
                ilike(deliveries.deliveryNumber, `%${qStr}%`),
                ilike(deliveries.doSap, `%${qStr}%`),
                ilike(deliveries.driverName, `%${qStr}%`),
                ilike(deliveries.vehicleNumber, `%${qStr}%`)
            )
        )
        .orderBy(desc(deliveries.scheduledDate))
        .limit(1);

    if (!d) return { found: false };

    return {
        found: true,
        delivery: {
            id: d.id,
            deliveryNumber: d.deliveryNumber || `DO-${d.id}`,
            doSap: d.doSap,
            status: d.status,
            scheduledDate: d.scheduledDate ? new Date(d.scheduledDate).toLocaleDateString("id-ID") : "-",
            deliveryDate: d.deliveryDate ? new Date(d.deliveryDate).toLocaleDateString("id-ID") : null,
            driverName: d.driverName,
            vehicleNumber: d.vehicleNumber,
            vehicleType: d.vehicleType,
            destination: d.tripDestination || d.shippingAddress || "-",
            notes: d.notes,
        },
    };
}
