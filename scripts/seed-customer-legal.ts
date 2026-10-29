import "dotenv/config";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import XLSX from "xlsx";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { customerLegalDocuments } from "../db/schema";
import { eq, ilike } from "drizzle-orm";

const EXCEL_PATH = path.resolve(
    "D:/[01] PROJECT/OneDrive_2026-10-29/34. Data Customers/1. List Data Legal Customers.xlsx"
);
const CUSTOMERS_ROOT = path.resolve("D:/[01] PROJECT/OneDrive_2026-10-29/34. Data Customers");
const UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads");

function ensureUploadDir() {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
}

function copyToManagedUpload(sourceFilePath: string): string {
    ensureUploadDir();
    const ext = path.extname(sourceFilePath);
    const basename = path.basename(sourceFilePath, ext);
    const sanitizedBasename = basename
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_")
        .slice(0, 40);
    const uniqueId = crypto.randomUUID();
    const targetFilename = `${sanitizedBasename}_${uniqueId}${ext}`;
    const targetPath = path.join(UPLOAD_DIR, targetFilename);

    fs.copyFileSync(sourceFilePath, targetPath);
    return `/api/uploads/${targetFilename}`;
}

const FOLDER_MAPPINGS: Record<string, string[]> = {
    "Ganda Alam Makmur": ["ganda alam makmur", "pt gam", "gam"],
    "Kayan Marine Shipyard": ["kayan marine shipyard", "pt. kayan marine shipyard", "pt kayan marine shipyard", "kayan"],
    "PT Andhomax": ["andhomax", "pt. andhomax prima energi", "pt andhomax prima energi", "pt andhomax"],
    "PT Kaot Energi Sejahtera": ["kaot", "pt. kaot energi sejahtera", "pt kaot energi sejahtera"],
    "PT Serayu Teknologi Indonesia": ["serayu", "pt. serayu teknologi indonesia", "pt serayu teknologi indonesia"],
    "Riung Mitra Lestari": ["riung mitra lestari", "pt.riung mitra lestari", "pt. riung mitra lestari", "pt riung mitra lestari", "rml"],
    "Triatra": ["triatra", "pt. triatra sinergia pratama", "pt triatra sinergia pratama"],
};

function classifyFile(fileName: string): "npwp" | "akta_pendirian" | "akta_perubahan" | "nib" | "pkp" | "sk_pendirian" | "sk_perubahan" | "ktp" | "other" {
    const lower = fileName.toLowerCase();
    if (lower.includes("npwp")) return "npwp";
    if (lower.includes("nib") || lower.includes("nomor induk berusaha")) return "nib";
    if (lower.includes("pkp") || lower.includes("sppkp") || lower.includes("skt")) return "pkp";
    if (lower.includes("ktp")) return "ktp";

    if (lower.includes("sk") || lower.includes("pengesahan") || lower.includes("menkum") || lower.includes("menkeh") || lower.includes("menteri")) {
        if (lower.includes("perubahan") || lower.includes("keputusan")) return "sk_perubahan";
        return "sk_pendirian";
    }

    if (lower.includes("akta") || lower.includes("akte")) {
        if (lower.includes("perubahan") || lower.includes("keputusan")) return "akta_perubahan";
        return "akta_pendirian";
    }

    return "other";
}

async function main() {
    console.log("🚀 Starting Customer Legal initial seed...");
    ensureUploadDir();

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL!,
    });
    const db = drizzle(pool);

    // 1. Process customer folders and copy files
    console.log("📂 Scanning customer document folders...");
    const customerFolderData: Record<string, {
        npwpFileUrl?: string;
        aktaPendirianFileUrl?: string;
        aktaPerubahanFileUrl?: string;
        nibFileUrl?: string;
        pkpPtkpFileUrl?: string;
        skKemenkumhamPendirianFileUrl?: string;
        skKemenkumhamPerubahanFileUrl?: string;
        ktpShareholderFileUrl?: string;
        otherDocuments: Array<{ title: string; fileUrl: string }>;
    }> = {};

    const customerFolders = fs.readdirSync(CUSTOMERS_ROOT, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

    for (const folderName of customerFolders) {
        const folderPath = path.join(CUSTOMERS_ROOT, folderName);
        const files = fs.readdirSync(folderPath);

        const docData = {
            otherDocuments: [] as Array<{ title: string; fileUrl: string }>,
        } as typeof customerFolderData[string];

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (fs.statSync(filePath).isDirectory()) continue;

            const category = classifyFile(file);
            const uploadUrl = copyToManagedUpload(filePath);

            if (category === "npwp" && !docData.npwpFileUrl) {
                docData.npwpFileUrl = uploadUrl;
            } else if (category === "akta_pendirian" && !docData.aktaPendirianFileUrl) {
                docData.aktaPendirianFileUrl = uploadUrl;
            } else if (category === "akta_perubahan" && !docData.aktaPerubahanFileUrl) {
                docData.aktaPerubahanFileUrl = uploadUrl;
            } else if (category === "nib" && !docData.nibFileUrl) {
                docData.nibFileUrl = uploadUrl;
            } else if (category === "pkp" && !docData.pkpPtkpFileUrl) {
                docData.pkpPtkpFileUrl = uploadUrl;
            } else if (category === "sk_pendirian" && !docData.skKemenkumhamPendirianFileUrl) {
                docData.skKemenkumhamPendirianFileUrl = uploadUrl;
            } else if (category === "sk_perubahan" && !docData.skKemenkumhamPerubahanFileUrl) {
                docData.skKemenkumhamPerubahanFileUrl = uploadUrl;
            } else if (category === "ktp" && !docData.ktpShareholderFileUrl) {
                docData.ktpShareholderFileUrl = uploadUrl;
            } else {
                docData.otherDocuments.push({
                    title: file,
                    fileUrl: uploadUrl,
                });
            }
        }

        customerFolderData[folderName] = docData;
        console.log(`Processed folder "${folderName}" with ${files.length} files.`);
    }

    // 2. Read only Sheet2 from Excel
    console.log(`📊 Reading Excel Sheet2 from: ${EXCEL_PATH}`);
    const wb = XLSX.readFile(EXCEL_PATH, { sheets: ["Sheet2"] });
    const ws = wb.Sheets["Sheet2"];
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

    // Header index
    const headers = (rawData[0] || []).map((h: any) => String(h || "").trim().toLowerCase());
    console.log("Excel Headers:", headers);

    const nameIdx = headers.findIndex((h) => h.includes("nama") || h.includes("customer"));
    const npwpIdx = headers.findIndex((h) => h.includes("npwp"));
    const aktaPndIdx = headers.findIndex((h) => h.includes("akta pendirian"));
    const aktaPrbIdx = headers.findIndex((h) => h.includes("akta perubahan"));
    const nibIdx = headers.findIndex((h) => h.includes("nib"));
    const pkpIdx = headers.findIndex((h) => h.includes("pkp") || h.includes("ptkp"));
    const skPndIdx = headers.findIndex((h) => h.includes("sk kemenkumham pendirian") || (h.includes("sk") && h.includes("pendirian")));
    const skPrbIdx = headers.findIndex((h) => h.includes("sk kemenkumham perubahan") || (h.includes("sk") && h.includes("perubahan")));
    const ktpIdx = headers.findIndex((h) => h.includes("ktp"));

    let createdCount = 0;
    let updatedCount = 0;

    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const rawCustomerName = String(row[nameIdx] || "").trim();
        if (!rawCustomerName) continue;

        // Clean up name
        const cleanName = rawCustomerName.replace(/\s+/g, " ").trim();
        const lowerName = cleanName.toLowerCase();

        // Check if matching any customer folder
        let matchedFolderKey: string | undefined;
        for (const [folderName, aliases] of Object.entries(FOLDER_MAPPINGS)) {
            if (aliases.some((alias) => lowerName.includes(alias) || alias.includes(lowerName))) {
                matchedFolderKey = folderName;
                break;
            }
        }

        const folderFiles = matchedFolderKey ? customerFolderData[matchedFolderKey] : undefined;

        const isYes = (val: any) => {
            if (!val) return false;
            const str = String(val).trim().toUpperCase();
            return str === "Y" || str === "YES" || str === "TRUE" || str === "1" || str === "ADA";
        };

        const npwpStatus = isYes(row[npwpIdx]) || !!folderFiles?.npwpFileUrl;
        const aktaPendirianStatus = isYes(row[aktaPndIdx]) || !!folderFiles?.aktaPendirianFileUrl;
        const aktaPerubahanStatus = isYes(row[aktaPrbIdx]) || !!folderFiles?.aktaPerubahanFileUrl;
        const nibStatus = isYes(row[nibIdx]) || !!folderFiles?.nibFileUrl;
        const pkpPtkpStatus = isYes(row[pkpIdx]) || !!folderFiles?.pkpPtkpFileUrl;
        const skKemenkumhamPendirianStatus = isYes(row[skPndIdx]) || !!folderFiles?.skKemenkumhamPendirianFileUrl;
        const skKemenkumhamPerubahanStatus = isYes(row[skPrbIdx]) || !!folderFiles?.skKemenkumhamPerubahanFileUrl;
        const ktpShareholderStatus = isYes(row[ktpIdx]) || !!folderFiles?.ktpShareholderFileUrl;

        // Check existing in DB
        const existing = await db
            .select()
            .from(customerLegalDocuments)
            .where(ilike(customerLegalDocuments.customerName, cleanName))
            .limit(1);

        const docRecord = {
            customerName: cleanName,
            npwpStatus,
            npwpFileUrl: folderFiles?.npwpFileUrl || existing[0]?.npwpFileUrl || null,
            aktaPendirianStatus,
            aktaPendirianFileUrl: folderFiles?.aktaPendirianFileUrl || existing[0]?.aktaPendirianFileUrl || null,
            aktaPerubahanStatus,
            aktaPerubahanFileUrl: folderFiles?.aktaPerubahanFileUrl || existing[0]?.aktaPerubahanFileUrl || null,
            nibStatus,
            nibFileUrl: folderFiles?.nibFileUrl || existing[0]?.nibFileUrl || null,
            pkpPtkpStatus,
            pkpPtkpFileUrl: folderFiles?.pkpPtkpFileUrl || existing[0]?.pkpPtkpFileUrl || null,
            skKemenkumhamPendirianStatus,
            skKemenkumhamPendirianFileUrl: folderFiles?.skKemenkumhamPendirianFileUrl || existing[0]?.skKemenkumhamPendirianFileUrl || null,
            skKemenkumhamPerubahanStatus,
            skKemenkumhamPerubahanFileUrl: folderFiles?.skKemenkumhamPerubahanFileUrl || existing[0]?.skKemenkumhamPerubahanFileUrl || null,
            ktpShareholderStatus,
            ktpShareholderFileUrl: folderFiles?.ktpShareholderFileUrl || existing[0]?.ktpShareholderFileUrl || null,
            otherDocuments: folderFiles?.otherDocuments || existing[0]?.otherDocuments || [],
            updatedAt: new Date(),
        };

        if (existing.length > 0) {
            await db
                .update(customerLegalDocuments)
                .set(docRecord)
                .where(eq(customerLegalDocuments.id, existing[0].id));
            updatedCount++;
        } else {
            await db.insert(customerLegalDocuments).values({
                ...docRecord,
                createdAt: new Date(),
            });
            createdCount++;
        }
    }

    console.log(`🎉 Seed finished! Created: ${createdCount}, Updated: ${updatedCount}`);
    await pool.end();
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});
