import { auth } from "../lib/auth";
import bcrypt from "bcryptjs";

async function checkBetterAuthPasswordConfig() {
    console.log("Checking if verify works with bcrypt");
    const plaintext = "password123";
    const hashed = await bcrypt.hash(plaintext, 10);
    console.log("Hashed:", hashed); // $2a$10$...
}
checkBetterAuthPasswordConfig();
