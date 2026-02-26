import { getAuthenticatedSession } from "@/lib/rbac"
import { db } from "@/db"
import { user as userTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { ProfileForm } from "./_components/profile-form"
import { PasswordForm } from "./_components/password-form"

export default async function AccountPage() {
    const session = await getAuthenticatedSession()

    // Ensure we have user data. getAuthenticatedSession throws if not.
    const user = session!.user
    const dbUser = await db.query.user.findFirst({
        where: eq(userTable.id, user.id),
    })

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
                <p className="text-muted-foreground">
                    Manage your profile information and account security.
                </p>
            </div>

            <div className="grid gap-6">
                <ProfileForm user={{
                    name: user.name,
                    email: user.email,
                    department: dbUser?.department ?? "",
                    jobTitle: dbUser?.jobTitle ?? "",
                }} />
                <PasswordForm />
            </div>
        </div>
    )
}
