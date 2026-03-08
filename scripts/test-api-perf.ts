import "dotenv/config"
import axios from "axios"

async function testApi() {
    const url = "http://localhost:3000/api/stocks-sap-new"
    console.log(`Fetching from ${url}...`)

    const start = Date.now()
    try {
        const response = await axios.get(url)
        const end = Date.now()

        console.log(`Status: ${response.status}`)
        console.log(`Rows: ${response.data.result.length}`)
        console.log(`Time: ${end - start}ms`)
        console.log(`Size: ${JSON.stringify(response.data).length / 1024} KB`)
    } catch (error: any) {
        console.error(`Error: ${error.message}`)
        if (error.response) {
            console.error(`Status: ${error.response.status}`)
        }
    }
}

testApi()
