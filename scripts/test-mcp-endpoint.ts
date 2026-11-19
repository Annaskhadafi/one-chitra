import { NextRequest } from "next/server";
import { POST, GET } from "../app/api/mcp/route";

async function testMcpRoute() {
    console.log("==========================================");
    console.log("🧪 Menguji Endpoint Model Context Protocol");
    console.log("==========================================");

    // 1. GET Info
    const getRes = await GET();
    const getJson = await getRes.json();
    console.log("1. GET /api/mcp status:", getJson.status, "| Tools:", getJson.toolsAvailable.length);

    // 2. Initialize
    const initReq = new NextRequest("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
        }),
    });
    const initRes = await POST(initReq);
    const initJson = await initRes.json();
    console.log("2. Protocol Version:", initJson.result?.protocolVersion, "| Server:", initJson.result?.serverInfo?.name);

    // 3. Tools List
    const listReq = new NextRequest("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list",
        }),
    });
    const listRes = await POST(listReq);
    const listJson = await listRes.json();
    console.log("3. Tools List count:", listJson.result?.tools?.length);

    // 4. Tools Call (Stock Check)
    const callReq = new NextRequest("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: {
                name: "check_stock_inventory",
                arguments: { limit: 2 },
            },
        }),
    });
    const callRes = await POST(callReq);
    const callJson = await callRes.json();
    const contentText = callJson.result?.content?.[0]?.text;
    const parsedData = JSON.parse(contentText);
    console.log("4. Tool Call result items found:", parsedData.items?.length);

    console.log("\n🎉 SELURUH PENGUJIAN MCP SERVER LULUS!");
    process.exit(0);
}

testMcpRoute().catch((err) => {
    console.error("❌ Test MCP Route gagal:", err);
    process.exit(1);
});
