import { Suspense } from "react"
import { AuthScreenFallback } from "@/components/auth/auth-screen-fallback"
import { ResetPasswordScreen } from "@/components/auth/reset-password-screen"

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<AuthScreenFallback />}>
            <ResetPasswordScreen />
        </Suspense>
    )
}
