import { db } from "../db";
import { portalItems } from "../db/schema";

async function main() {
    console.log("Seeding portal items...");
    try {
        await db.insert(portalItems).values([
            {
                name: "HCMS",
                description: "Human Capital Management System terintegrasi.",
                icon: "Users",
                color: "#8b5cf6",
                url: "https://hcms.example.com",
                category: "Human Capital",
                order: 1
            },
            {
                name: "Chitra Tire System",
                description: "Manajemen siklus hidup ban dan pemantauan performa.",
                icon: "Truck",
                color: "#3b82f6",
                url: "https://cts.example.com",
                category: "Central Services",
                order: 2
            },
            {
                name: "Integrated Chitra System",
                description: "Portal utama integrasi seluruh sistem operasional.",
                icon: "LayoutGrid",
                color: "#f59e0b",
                url: "https://ics.example.com",
                category: "Main",
                order: 3
            },
            {
                name: "Chitra Paratama Website",
                description: "Profil perusahaan dan informasi publik.",
                icon: "Globe",
                color: "#10b981",
                url: "https://chitraparatama.co.id",
                category: "Main",
                order: 4
            }
        ]).onConflictDoNothing();
        console.log("Seeded successfully!");
    } catch (error) {
        console.error("Failed to seed:", error);
    }
    process.exit(0);
}

main();
