
import Papa from "papaparse";

async function checkData() {
    console.log("Fetching CSV data sample...");
    try {
        const response = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vTFCYrDPugIyxFQMQaUS2e11OY8NIGSOqd-jz5jznHSMGORjl0SSFEFNA2p0Iw_r8FHz3PGJ78IncXk/pub?gid=1444121083&single=true&output=csv", {
            cache: "no-store"
        });
        const csvText = await response.text();
        const { data } = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim()
        });
        console.log("Sample data (row 0):", data[0]);
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

checkData().then(() => process.exit());
