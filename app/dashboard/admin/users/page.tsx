import { Suspense } from "react"
import { getUsers } from "@/app/actions/users"
import { getRoles } from "@/app/actions/roles"
import { UserList } from "./_components/user-list"

export default async function UsersPage() {
    const users = await getUsers()
    const roles = await getRoles()

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Users</h1>
                    <p className="text-muted-foreground">Manage users and assign roles.</p>
                </div>
            </div>

            <Suspense fallback={<div>Loading users...</div>}>
                <UserList users={users} roles={roles} />
            </Suspense>
        </div>
    )
}
