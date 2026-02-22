
import Papa from "papaparse";

async function checkHeaders() {
    console.log("Fetching CSV headers...");
    try {
        const response = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vTFCYrDPugIyxFQMQaUS2e11OY8NIGSOqd-jz5jznHSMGORjl0SSFEFNA2p0Iw_r8FHz3PGJ78IncXk/pub?gid=1444121083&single=true&output=csv", {
            cache: "no-store"
        });
        const csvText = await response.text();
        const { data } = Papa.parse(csvText, {
            header: false,
            preview: 1
        });
        console.log("Headers found:", data[0]);
    } catch (error) {
        console.error("Error fetching headers:", error);
    }
}

checkHeaders().then(() => process.exit());
