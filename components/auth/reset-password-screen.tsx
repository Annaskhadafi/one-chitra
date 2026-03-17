"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"
import { Eye, EyeOff, Loader2 } from "lucide-react"

type ResetPasswordResult = {
    error?: {
        message?: string
    }
}

export function ResetPasswordScreen() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams?.get("token") ?? ""
    const invalidTokenMessage = useMemo(() => {
        if (searchParams?.get("error") === "INVALID_TOKEN" || !token) {
            return "Link reset password tidak valid atau sudah kedaluwarsa."
        }

        return ""
    }, [searchParams, token])

    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(invalidTokenMessage)
    const [successMessage, setSuccessMessage] = useState("")

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!token) {
            setError("Link reset password tidak valid atau sudah kedaluwarsa.")
            return
        }

        if (password.length < 8) {
            setError("Password baru minimal 8 karakter.")
            return
        }

        if (password !== confirmPassword) {
            setError("Konfirmasi password belum sama.")
            return
        }

        setIsLoading(true)
        setError("")
        setSuccessMessage("")

        try {
            const result = await authClient.resetPassword({
                newPassword: password,
                token,
            }) as unknown as ResetPasswordResult

            if (result.error) {
                setError(result.error.message || "Gagal memperbarui password")
                return
            }

            setSuccessMessage("Password berhasil diperbarui. Anda akan diarahkan ke halaman login.")
            window.setTimeout(() => {
                router.push("/sign-in?reset=success")
            }, 1200)
        } catch (_error) {
            setError("Terjadi kendala saat memperbarui password")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100/80 p-4">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_12px_40px_rgba(15,23,42,0.12)]">
                <div className="mb-8 space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reset Password</h1>
                    <p className="text-sm leading-relaxed text-slate-500">
                        Masukkan password baru untuk akun One Chitra Anda.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <Alert variant="destructive" className="rounded-xl">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {successMessage && (
                        <Alert className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-900">
                            <AlertDescription>{successMessage}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="new-password" className="text-sm font-semibold text-slate-800">
                            Password Baru
                        </Label>
                        <div className="relative">
                            <Input
                                id="new-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="Minimal 8 karakter"
                                disabled={isLoading}
                                className="h-12 rounded-xl border-slate-200 bg-white pr-10 shadow-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((current) => !current)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirm-password" className="text-sm font-semibold text-slate-800">
                            Konfirmasi Password Baru
                        </Label>
                        <div className="relative">
                            <Input
                                id="confirm-password"
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                placeholder="Ulangi password baru"
                                disabled={isLoading}
                                className="h-12 rounded-xl border-slate-200 bg-white pr-10 shadow-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword((current) => !current)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                                aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                            >
                                {showConfirmPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                            </button>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        className="h-12 w-full rounded-xl bg-[#5233FF] text-[15px] font-medium text-white hover:bg-[#4326db]"
                        disabled={isLoading || !token}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Memproses...
                            </>
                        ) : (
                            "Simpan Password Baru"
                        )}
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full rounded-xl"
                        onClick={() => router.push("/sign-in")}
                        disabled={isLoading}
                    >
                        Kembali ke Login
                    </Button>
                </form>
            </div>
        </div>
    )
}
