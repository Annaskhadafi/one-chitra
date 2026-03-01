import { db } from "../db";
import { user } from "../db/schema";
import { account } from "../db/schema/auth";
import { eq, and } from "drizzle-orm";
import bcryptjs from "bcryptjs";

async function main() {
    console.log("Mencari user & akun di database...");

    // Gabungkan user dan account untuk mengecek password auth
    const userAccounts = await db
        .select({
            id: user.id,
            email: user.email,
            role: user.role,
            providerId: account.providerId,
            password: account.password
        })
        .from(user)
        .leftJoin(account, eq(user.id, account.userId));

    console.log("Daftar user dan kredensialnya:");
    for (const u of userAccounts) {
        console.log(`- Email: '${u.email}', Role: ${u.role}, Provider: ${u.providerId}, Password: ${u.password ? 'Ada (' + u.password.substring(0, 10) + '...)' : 'NULL'}`);
    }

    // Set ulang password untuk salah satu user "scm@chitraparatama.co.id" ke tabel account
    const scmAccount = userAccounts.find(u => u.email === "scm@chitraparatama.co.id" && u.providerId === "credential");

    if (scmAccount) {
        console.log("Memperbarui password SCM ke 'password123'...");
        const hashedPassword = await bcryptjs.hash("password123", 10);
        await db.update(account)
            .set({ password: hashedPassword })
            .where(
                and(
                    eq(account.userId, scmAccount.id),
                    eq(account.providerId, "credential")
                )
            );
        console.log("Sukses Memperbarui Password!");
    } else {
        console.log("Akun SCM Credential tidak ditemukan.");
    }

    process.exit(0);
}

main().catch(console.error);
