const testApi = async () => {
    try {
        const response = await fetch("http://localhost:3000/api/mobile/auth", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: "scm@chitraparatama.co.id",
                password: "password123"
            })
        });
        const data = await response.json();
        console.log("Status:", response.status);
        console.log("Response:", data);
    } catch (e) {
        console.error("Error fetching:", e);
    }
}
testApi();
