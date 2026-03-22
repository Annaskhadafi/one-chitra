import "dotenv/config"
import axios from "axios"

async function testNewApi() {
    const baseUrl = "http://localhost:3000/api/stocks-sap-new"

    console.log("Testing Paginated API...")
    try {
        const res1 = await axios.get(`${baseUrl}?page=1&pageSize=10`)
        console.log(`Page 1 Size: ${res1.data.result.length}`)
        console.log(`Total Count: ${res1.data.pagination.totalCount}`)
        console.log(`Stats Total Value: ${res1.data.stats.totalValue}`)

        console.log("\nTesting Search...")
        const resSearch = await axios.get(`${baseUrl}?search=REPAIR`)
        console.log(`Search result count: ${resSearch.data.result.length}`)

    } catch (e: any) {
        console.log("Error testing API (is dev server running?):", e.message)
    }
}

testNewApi()
