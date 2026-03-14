import { Suspense } from "react"
import { getUsers } from "@/app/actions/users"
import { getRoles } from "@/app/actions/roles"
import { getWarehouses } from "@/app/actions/warehouse"
import { UserList } from "./_components/user-list"

export default async function UsersPage() {
    const [users, roles, warehouses] = await Promise.all([
        getUsers(),
        getRoles(),
        getWarehouses(),
    ])

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Users</h1>
                    <p className="text-muted-foreground">Manage users and assign roles.</p>
                </div>
            </div>

            <Suspense fallback={<div>Loading users...</div>}>
                <UserList users={users} roles={roles} warehouses={warehouses} />
            </Suspense>
        </div>
    )
}
