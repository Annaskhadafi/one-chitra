// Script inject Cover Letter ke navbar_menu_config_v1 di database
// Run: npx tsx scripts/add-cover-letter-to-navbar.ts

import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const client = await pool.connect();
    try {
        // Ambil konfigurasi navbar saat ini
        const res = await client.query(`SELECT value FROM settings WHERE key = 'navbar_menu_config_v1' LIMIT 1`);
        if (res.rows.length === 0) {
            console.log("Tidak ada navbar config di DB, app akan pakai default dari navigationConfig.");
            console.log("Tidak perlu inject - Cover Letter sudah ada di navigationConfig.");
            return;
        }

        const config = JSON.parse(res.rows[0].value);

        // Cari section 'SCM Management'
        const scmSection = config.find((s: any) => s.title === "SCM Management");
        if (!scmSection) {
            console.error("Section 'SCM Management' tidak ditemukan!");
            console.log("Sections yang ada:", config.map((s: any) => s.title));
            return;
        }

        // Cari item 'Outbound & Operations'
        const outboundItem = scmSection.items.find((i: any) =>
            i.title.includes("Outbound") || i.title.includes("Operations")
        );
        if (!outboundItem) {
            console.error("Item 'Outbound & Operations' tidak ditemukan!");
            console.log("Items yang ada:", scmSection.items.map((i: any) => i.title));
            return;
        }

        // Cek apakah Cover Letter sudah ada
        const existingCoverLetter = outboundItem.items?.find((s: any) =>
            s.url === "/dashboard/cover-letter" || s.title === "Cover Letter"
        );
        if (existingCoverLetter) {
            console.log("Cover Letter sudah ada di navbar, tidak perlu tambah.");
            return;
        }

        // Cari posisi setelah Billing
        const billingIndex = outboundItem.items?.findIndex((s: any) => s.title === "Billing") ?? -1;
        const newItem = {
            id: `sub-cover-letter-${Date.now()}`,
            title: "Cover Letter",
            url: "/dashboard/cover-letter",
            resource: "cover-letter",
            hidden: false,
            openInNewTab: false,
            isCustom: false,
            linkType: "internal",
            externalOpenMode: "new_tab",
            iframeManualEnabled: false,
            iframeManualCode: "",
        };

        if (billingIndex >= 0) {
            outboundItem.items.splice(billingIndex + 1, 0, newItem);
        } else {
            outboundItem.items.push(newItem);
        }

        // Simpan kembali
        await client.query(
            `UPDATE settings SET value = $1, "updated_at" = NOW() WHERE key = 'navbar_menu_config_v1'`,
            [JSON.stringify(config)]
        );

        console.log("✓ Cover Letter berhasil ditambahkan ke navbar di posisi setelah Billing");
        console.log("  Restart dev server atau hard-refresh browser untuk melihat perubahannya.");
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(console.error);
