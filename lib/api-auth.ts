import { auth } from "@/lib/auth"

export async function requireApiSession(headers: Headers) {
    const session = await auth.api.getSession({ headers })

    if (!session?.user?.id) {
        return null
    }

    return session
}
