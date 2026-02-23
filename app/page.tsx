"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { signIn } from "@/lib/auth-client";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Home() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session?.user && !isPending) {
      router.push("/dashboard");
    }
  }, [session, isPending, router]);

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

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" suppressHydrationWarning>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4 font-sans text-gray-900" suppressHydrationWarning>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden flex flex-col md:flex-row min-h-[640px] border border-gray-100/50">
        {/* Left Pane - Gradient */}
        <div className="w-full md:w-[45%] lg:w-[48%] bg-gradient-to-br from-[#1A4BFF] via-[#5C24FF] to-[#D6B4FF] p-10 md:p-14 flex flex-col justify-between relative overflow-hidden text-white rounded-l-3xl md:rounded-r-none md:rounded-3xl m-2 md:m-3">
          {/* Abstract glows for visual interest */}
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-400 opacity-30 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-fuchsia-300 opacity-30 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>

          <div className="relative z-10 w-40 h-auto">
            {/* Logo used as icon/branding */}
            <img src="/brand/Chitra-Paratama.png" alt="One Chitra" className="w-full h-auto brightness-0 invert drop-shadow-md" />
          </div>

          <div className="relative z-10 mt-auto pb-4 pt-16">
            <h1 className="text-3xl md:text-[2.25rem] lg:text-[2.75rem] font-bold leading-[1.2] tracking-tight text-white mb-2">
              Empowering Chitra Paratama’s Growth Through Digital Synergy.
            </h1>
          </div>
        </div>

        {/* Right Pane - Form */}
        <div className="w-full md:w-[55%] lg:w-[52%] px-8 py-10 md:py-16 md:px-14 lg:px-20 flex flex-col justify-center bg-white relative">

          <div className="mb-10 lg:mb-12">
            <h1 className="text-3xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 mb-6">
              One Chitra
            </h1>
            <h2 className="text-2xl lg:text-[1.75rem] font-bold mb-3 tracking-tight text-[#5233FF]">All In one Platform</h2>
            <p className="text-gray-500 text-sm leading-relaxed max-w-sm mt-3">
              Manage inventory, track sales leads, and monitor supply chain performance from a single dashboard.
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
        </div>
      </div>
    </div>
  );
}
