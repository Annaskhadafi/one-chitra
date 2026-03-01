import { auth } from "../lib/auth";

async function testBetterAuthLogin() {
    try {
        console.log("Testing better auth api...");

        // Memakai pseudo Request
        const result = await auth.api.signInEmail({
            body: {
                email: "scm@chitraparatama.co.id",
                password: "password123",
            },
            asResponse: true
        });

        console.log("Result status:", result.status);
        const json = await result.json().catch(() => null);
        console.log("Result body:", json);
    } catch (err: any) {
        console.error("Better Auth error:", err.message);
        if (err.cause) console.error("Cause:", err.cause);
    }
    process.exit(0);
}

testBetterAuthLogin();
