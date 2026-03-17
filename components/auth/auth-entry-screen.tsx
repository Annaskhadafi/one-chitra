"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/theme-toggle"
import { authClient, signIn, useSession } from "@/lib/auth-client"
import { Eye, EyeOff, Loader2 } from "lucide-react"

function getSafeCallbackUrl(searchParams: { get(name: string): string | null } | null) {
    const callbackUrl = searchParams?.get("callbackUrl")

    if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
        return "/dashboard"
    }

    return callbackUrl
}

type AuthActionResult = {
    data?: {
        message?: string
    }
    error?: {
        message?: string
    }
}

export function AuthEntryScreen() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const callbackUrl = useMemo(() => getSafeCallbackUrl(searchParams), [searchParams])
    const initialInfoMessage = useMemo(() => {
        if (searchParams?.get("reset") === "success") {
            return "Password berhasil diperbarui. Silakan login dengan password baru Anda."
        }

        if (searchParams?.get("error") === "INVALID_TOKEN") {
            return "Link reset password tidak valid atau sudah kedaluwarsa."
        }

        return ""
    }, [searchParams])

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false)
    const [isResetPasswordLoading, setIsResetPasswordLoading] = useState(false)
    const [error, setError] = useState("")
    const [infoMessage, setInfoMessage] = useState(initialInfoMessage)
    const { data: session, isPending: isSessionPending } = useSession()

    useEffect(() => {
        if (!isSessionPending && session?.user) {
            router.replace(callbackUrl)
        }
    }, [callbackUrl, isSessionPending, router, session])

    useEffect(() => {
        setInfoMessage(initialInfoMessage)
    }, [initialInfoMessage])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsLoading(true)
        setError("")
        setInfoMessage("")

        try {
            const result = await signIn.email({
                email,
                password,
            })

            if (result.error) {
                setError(result.error.message || "Sign in gagal")
                return
            }

            router.push(callbackUrl)
        } catch (_error) {
            setError("Terjadi kendala saat login")
        } finally {
            setIsLoading(false)
        }
    }

    const handleMagicLinkSignIn = async () => {
        const normalizedEmail = email.trim()

        if (!normalizedEmail) {
            setError("Email wajib diisi untuk mengirim magic link.")
            setInfoMessage("")
            return
        }

        setIsMagicLinkLoading(true)
        setError("")
        setInfoMessage("")

        try {
            const result = await signIn.magicLink({
                email: normalizedEmail,
                callbackURL: callbackUrl,
            })

            if (result.error) {
                setError(result.error.message || "Gagal mengirim magic link")
                return
            }

            setInfoMessage("Magic link sudah dikirim. Silakan cek email Anda.")
        } catch (_error) {
            setError("Terjadi kendala saat mengirim magic link")
        } finally {
            setIsMagicLinkLoading(false)
        }
    }

    const handleResetPasswordRequest = async () => {
        const normalizedEmail = email.trim()

        if (!normalizedEmail) {
            setError("Email wajib diisi untuk mengirim reset password.")
            setInfoMessage("")
            return
        }

        setIsResetPasswordLoading(true)
        setError("")
        setInfoMessage("")

        try {
            const result = await authClient.requestPasswordReset({
                email: normalizedEmail,
                redirectTo: "/reset-password",
            }) as unknown as AuthActionResult

            if (result.error) {
                setError(result.error.message || "Gagal mengirim reset password")
                return
            }

            setInfoMessage(result.data?.message || "Link reset password sudah dikirim. Silakan cek email Anda.")
        } catch (_error) {
            setError("Terjadi kendala saat mengirim reset password")
        } finally {
            setIsResetPasswordLoading(false)
        }
    }

    const isBusy = isLoading || isMagicLinkLoading || isResetPasswordLoading

    if (isSessionPending || session?.user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100">
                <Loader2 className="h-8 w-8 animate-spin text-[#5233FF]" />
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100/80 p-4 font-sans text-gray-900">
            <div className="absolute right-4 top-4">
                <ThemeToggle />
            </div>
            <div className="flex min-h-[680px] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-gray-100/70 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.12)] md:flex-row">
                <div className="relative m-2 flex w-full flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-[#1A4BFF] via-[#5C24FF] to-[#D6B4FF] p-10 text-white md:m-3 md:w-[45%] md:rounded-r-none lg:w-[48%]">
                    <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-400 opacity-30 blur-[100px] mix-blend-screen" />
                    <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-fuchsia-300 opacity-30 blur-[100px] mix-blend-screen" />

                    <div className="relative z-10 w-40">
                        <Image
                            src="/brand/Chitra-Paratama.png"
                            alt="One Chitra"
                            width={220}
                            height={80}
                            className="h-auto w-full brightness-0 invert drop-shadow-md"
                            priority
                        />
                    </div>

                    <div className="relative z-10 mt-auto pb-4 pt-16">
                        <h1 className="mb-2 text-3xl font-bold leading-[1.2] tracking-tight text-white md:text-[2.25rem] lg:text-[2.75rem]">
                            Empowering Chitra Paratama&apos;s Growth Through Digital Synergy.
                        </h1>
                    </div>
                </div>

                <div className="flex w-full flex-col justify-center bg-white px-8 py-10 md:w-[55%] md:px-14 md:py-16 lg:w-[52%] lg:px-20">
                    <div className="mb-10 lg:mb-12">
                        <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-gray-900 md:text-3xl lg:text-4xl">
                            One Chitra
                        </h1>
                        <h2 className="mb-3 text-2xl font-bold tracking-tight text-[#5233FF] lg:text-[1.75rem]">
                            All In One Platform
                        </h2>
                        <p className="mt-3 max-w-sm text-sm leading-relaxed text-gray-500">
                            Manage inventory, track sales leads, and monitor supply chain performance from a single dashboard.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5 lg:space-y-6">
                        {error && (
                            <Alert variant="destructive" className="rounded-xl">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {infoMessage && (
                            <Alert className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-900">
                                <AlertDescription>{infoMessage}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-semibold text-gray-800">
                                Your email
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="nama@chitraparatama.co.id"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                                disabled={isBusy}
                                className="h-12 rounded-xl border-gray-200 bg-white shadow-sm transition-all placeholder:text-gray-400 focus-visible:border-[#5C24FF] focus-visible:ring-1 focus-visible:ring-[#5C24FF]"
                            />
                            <p className="text-xs text-gray-500">
                                Magic link dan reset password akan dikirim ke email yang Anda isi.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-semibold text-gray-800">
                                Password
                            </Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••••••"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    required
                                    disabled={isBusy}
                                    className="h-12 rounded-xl border-gray-200 bg-white pr-10 shadow-sm transition-all placeholder:text-gray-400 focus-visible:border-[#5C24FF] focus-visible:ring-1 focus-visible:ring-[#5C24FF]"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((current) => !current)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 focus:outline-none"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                                </button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="mt-2 h-12 w-full rounded-xl bg-[#5233FF] text-[15px] font-medium text-white shadow-[0_4px_14px_0_rgba(82,51,255,0.39)] transition-all duration-200 hover:bg-[#4326db]"
                            disabled={isBusy}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Please wait...
                                </>
                            ) : (
                                "Sign In"
                            )}
                        </Button>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="h-12 rounded-xl border-gray-200 text-[15px] font-medium"
                                disabled={isBusy}
                                onClick={handleMagicLinkSignIn}
                            >
                                {isMagicLinkLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    "Send Magic Link"
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="h-12 rounded-xl border-gray-200 text-[15px] font-medium"
                                disabled={isBusy}
                                onClick={handleResetPasswordRequest}
                            >
                                {isResetPasswordLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    "Reset Password"
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
