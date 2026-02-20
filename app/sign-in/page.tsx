"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signIn } from "@/lib/auth-client";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function SignInPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const result = await signIn.email({
                email,
                password,
            });

            if (result.error) {
                setError(result.error.message || "Sign in failed");
            } else {
                router.push("/dashboard");
            }
        } catch (_err) {
            setError("An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4 font-sans text-gray-900">
            <div className="w-full max-w-5xl bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden flex flex-col md:flex-row min-h-[640px] border border-gray-100/50">
                {/* Left Pane - Gradient */}
                <div className="w-full md:w-[45%] lg:w-[48%] bg-gradient-to-br from-[#1A4BFF] via-[#5C24FF] to-[#D6B4FF] p-10 md:p-14 flex flex-col justify-between relative overflow-hidden text-white rounded-l-3xl md:rounded-r-none md:rounded-3xl m-2 md:m-3">
                    {/* Abstract glows for visual interest */}
                    <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-400 opacity-30 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>
                    <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-fuchsia-300 opacity-30 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>

                    <div className="relative z-10 w-40 h-auto">
                        {/* Logo used as icon/branding */}
                        <img src="/uploads/Chitra-Paratama.png" alt="One Chitra" className="w-full h-auto brightness-0 invert drop-shadow-md" />
                    </div>

                    <div className="relative z-10 mt-auto pb-4 pt-16">
                        <p className="text-sm font-medium text-white/90 mb-4 tracking-wide">You can easily</p>
                        <h1 className="text-3xl md:text-[2.5rem] lg:text-5xl font-bold leading-[1.15] tracking-tight">
                            Get access your personal hub for clarity and productivity
                        </h1>
                    </div>
                </div>

                {/* Right Pane - Form */}
                <div className="w-full md:w-[55%] lg:w-[52%] px-8 py-10 md:py-16 md:px-14 lg:px-20 flex flex-col justify-center bg-white">
                    <div className="mb-10 lg:mb-12">
                        <div className="flex items-center gap-3 mb-6">
                            <img src="/uploads/Chitra-Paratama.png" alt="One Chitra Logo" className="h-10 md:h-12 w-auto object-contain" />
                            <h1 className="text-3xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900">
                                One Chitra
                            </h1>
                        </div>
                        <h2 className="text-2xl lg:text-[1.75rem] font-bold mb-3 tracking-tight text-[#5233FF]">All In one Platform</h2>
                        <p className="text-gray-500 text-sm leading-relaxed max-w-sm mt-3">
                            Access your tasks, notes, and projects anytime, anywhere - and keep everything flowing in one place.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5 lg:space-y-6">
                        {error && (
                            <Alert variant="destructive" className="rounded-xl">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email" className="font-semibold text-gray-800 text-sm">Your email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="farazhaidet786@gmail.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={isLoading}
                                className="h-12 rounded-xl bg-white border-gray-200 focus-visible:ring-1 focus-visible:ring-[#5C24FF] focus-visible:border-[#5C24FF] transition-all shadow-sm placeholder:text-gray-400"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="font-semibold text-gray-800 text-sm">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={isLoading}
                                    className="h-12 rounded-xl bg-white border-gray-200 focus-visible:ring-1 focus-visible:ring-[#5C24FF] focus-visible:border-[#5C24FF] pr-10 transition-all shadow-sm placeholder:text-gray-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                                </button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 rounded-xl bg-[#5233FF] hover:bg-[#4326db] text-white font-medium text-[15px] shadow-[0_4px_14px_0_rgba(82,51,255,0.39)] transition-all duration-200 mt-2"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Please wait...
                                </>
                            ) : (
                                "Get Started"
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 flex items-center justify-center space-x-4">
                        <div className="h-[1px] bg-gray-200 flex-1"></div>
                        <span className="text-gray-400 text-xs font-medium px-2 bg-white">or continue with</span>
                        <div className="h-[1px] bg-gray-200 flex-1"></div>
                    </div>

                    <div className="mt-6 flex gap-3 lg:gap-4">
                        <Button type="button" variant="outline" className="flex-1 rounded-full h-11 bg-[#f4f4f5] border-transparent hover:bg-gray-200/80 hover:border-transparent text-gray-600 transition-colors">
                            <span className="font-bold font-serif text-[15px] tracking-tighter">Bē</span>
                        </Button>
                        <Button type="button" variant="outline" className="flex-1 rounded-full h-11 bg-[#f4f4f5] border-transparent hover:bg-gray-200/80 hover:border-transparent text-gray-600 transition-colors">
                            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                        </Button>
                        <Button type="button" variant="outline" className="flex-1 rounded-full h-11 bg-[#f4f4f5] border-transparent hover:bg-gray-200/80 hover:border-transparent text-gray-600 transition-colors">
                            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                        </Button>
                    </div>

                    <p className="mt-auto pt-8 text-center text-[13px] text-gray-500 font-medium pb-2">
                        Don&apos;t have an account?{" "}
                        <Link href="/sign-up" className="font-semibold text-[#5233FF] hover:text-[#4326db] hover:underline transition-all">
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}