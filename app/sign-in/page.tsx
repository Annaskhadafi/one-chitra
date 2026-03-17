import { Suspense } from "react"
import { AuthEntryScreen } from "@/components/auth/auth-entry-screen"
import { AuthScreenFallback } from "@/components/auth/auth-screen-fallback"

export default function SignInPage() {
    return (
        <Suspense fallback={<AuthScreenFallback />}>
            <AuthEntryScreen />
        </Suspense>
    )
}
