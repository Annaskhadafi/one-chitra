import { NextRequest, NextResponse } from "next/server";
import {
    checkStockInventory,
    getRevenueSummary,
    createSalesQuotation,
    generateQuotationPdfBuffer,
} from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";

/**
 * Standard MCP Tools Definitions
 */
const MCP_TOOLS = [
    {
        name: "check_stock_inventory",
        description: "Mengecek stok produk dan inventaris di seluruh gudang ONE-CHITRA. Menampilkan jumlah total, booked, dan available.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Nama barang, ukuran, material number, atau brand (misal '12.00R24', 'Michelin')" },
                warehouseName: { type: "string", description: "Nama gudang spesifik jika ada (misal 'Balikpapan', 'Jakarta')" },
                limit: { type: "number", description: "Maksimal hasil yang dikembalikan (default: 15)" },
            },
        },
    },
    {
        name: "get_revenue_summary",
        description: "Mengambil laporan omset, total revenue penjualan, dan pelanggan teratas berdasarkan Sales Orders resmi ONE-CHITRA.",
        inputSchema: {
            type: "object",
            properties: {
                period: { type: "string", enum: ["today", "this_month", "this_year", "custom"], description: "Periode analisa" },
                startDate: { type: "string", description: "Format YYYY-MM-DD jika custom" },
                endDate: { type: "string", description: "Format YYYY-MM-DD jika custom" },
            },
        },
    },
    {
        name: "create_sales_quotation",
        description: "Membuat penawaran harga (Sales Quotation) resmi baru di sistem ONE-CHITRA lengkap dengan nomor penawaran otomatis.",
        inputSchema: {
            type: "object",
            required: ["customerName", "items"],
            properties: {
                customerName: { type: "string", description: "Nama pelanggan / perusahaan (misal 'PT Sumber Rejeki')" },
                items: {
                    type: "array",
                    description: "Daftar barang yang ditawarkan",
                    items: {
                        type: "object",
                        required: ["productQuery", "quantity"],
                        properties: {
                            productQuery: { type: "string", description: "Nama / material number barang" },
                            quantity: { type: "number", description: "Jumlah unit barang" },
                            unitPrice: { type: "number", description: "Harga satuan jika ingin ditentukan spesifik (opsional)" },
                        },
                    },
                },
                clientNote: { type: "string", description: "Catatan khusus atau syarat penawaran" },
                validUntilDays: { type: "number", description: "Masa berlaku penawaran dalam hari (default 14 hari)" },
            },
        },
    },
    {
        name: "get_quotation_pdf",
        description: "Menghasilkan buffer dokumen PDF resmi A4 untuk quotation tertentu yang siap dikirimkan.",
        inputSchema: {
            type: "object",
            required: ["quotationId"],
            properties: {
                quotationId: { type: "number", description: "ID quotation dari sistem" },
            },
        },
    },
];

/**
 * Handle MCP JSON-RPC 2.0 requests
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, method, params } = body;

        // 1. Initialize
        if (method === "initialize") {
            return NextResponse.json({
                jsonrpc: "2.0",
                id,
                result: {
                    protocolVersion: "2024-11-05",
                    serverInfo: {
                        name: "one-chitra-mcp-server",
                        version: "1.0.0",
                    },
                    capabilities: {
                        tools: {},
                    },
                },
            });
        }

        // 2. Tools List
        if (method === "tools/list") {
            return NextResponse.json({
                jsonrpc: "2.0",
                id,
                result: {
                    tools: MCP_TOOLS,
                },
            });
        }

        // 3. Tools Call
        if (method === "tools/call") {
            const { name, arguments: args } = params || {};
            let toolResult: any;

            switch (name) {
                case "check_stock_inventory":
                    toolResult = await checkStockInventory(args || {});
                    break;
                case "get_revenue_summary":
                    toolResult = await getRevenueSummary(args || {});
                    break;
                case "create_sales_quotation":
                    toolResult = await createSalesQuotation(args || {});
                    break;
                case "get_quotation_pdf": {
                    const pdf = await generateQuotationPdfBuffer(args?.quotationId);
                    toolResult = {
                        fileName: pdf.fileName,
                        fileSizeBytes: pdf.buffer.length,
                        base64Data: pdf.buffer.toString("base64"),
                    };
                    break;
                }
                default:
                    return NextResponse.json({
                        jsonrpc: "2.0",
                        id,
                        error: {
                            code: -32601,
                            message: `Tool '${name}' tidak ditemukan.`,
                        },
                    });
            }

            return NextResponse.json({
                jsonrpc: "2.0",
                id,
                result: {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(toolResult, null, 2),
                        },
                    ],
                },
            });
        }

        // Method not supported
        return NextResponse.json({
            jsonrpc: "2.0",
            id,
            error: {
                code: -32601,
                message: `Method '${method}' tidak didukung oleh MCP Server ini.`,
            },
        });
    } catch (err: any) {
        return NextResponse.json(
            {
                jsonrpc: "2.0",
                id: null,
                error: {
                    code: -32603,
                    message: "Internal MCP Server error: " + err.message,
                },
            },
            { status: 500 }
        );
    }
}

/**
 * GET Method untuk info & health check MCP
 */
export async function GET() {
    return NextResponse.json({
        status: "online",
        service: "ONE-CHITRA Dual-Use MCP Server",
        protocol: "Model Context Protocol (JSON-RPC 2.0)",
        toolsAvailable: MCP_TOOLS.map((t) => t.name),
    });
}
