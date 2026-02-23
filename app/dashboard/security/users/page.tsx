import { Suspense } from "react"
import { getSecurityUsers } from "@/app/actions/security"
import { getRoles } from "@/app/actions/roles"
import { SecurityUserTable } from "./_components/security-user-table"

export default async function SecurityUsersPage() {
    const [users, roles] = await Promise.all([getSecurityUsers(), getRoles()])

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
                <p className="text-muted-foreground">Create, edit, ban, or remove users and assign roles.</p>
            </div>
            <Suspense fallback={<div className="text-muted-foreground text-sm">Loading users…</div>}>
                <SecurityUserTable users={users} roles={roles} />
            </Suspense>
        </div>
    )
}
