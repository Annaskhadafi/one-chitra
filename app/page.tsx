"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "@/components/login-form";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session?.user && !isPending) {
      router.push("/dashboard");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session?.user) {
    return null; // or a loading state while redirect happens, though useEffect should cover it
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Side - Visuals */}
      <div className="relative hidden lg:flex flex-col justify-center items-center bg-zinc-900 text-white p-10 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-cyan-900/40 z-0" />
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-blue-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-purple-600/20 rounded-full blur-[120px]" />

        {/* Content */}
        <div className="relative z-10 max-w-lg text-center space-y-6">
          <div className="flex justify-center mb-8">
            <Image
              src="/codeguide-logo.png"
              alt="One Chitra Logo"
              width={120}
              height={120}
              className="rounded-2xl shadow-2xl shadow-blue-500/20"
              priority
            />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-wb from-white to-white/70 bg-clip-text text-transparent font-parkinsans leading-tight">
            Welcome to One Chitra
          </h1>
          <p className="text-lg text-zinc-300 leading-relaxed">
            Manage your inventory, sales, and logistics with a powerful, modern, and intuitive dashboard.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 pt-4">
            {["Inventory", "Sales", "Deliveries", "Analytics"].map((item) => (
              <span key={item} className="px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-sm backdrop-blur-sm">
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Footer on left side */}
        <div className="absolute bottom-8 text-zinc-500 text-sm">
          &copy; {new Date().getFullYear()} One Chitra System. All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-10 lg:p-20 bg-background relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Sign in to your account</h2>
            <p className="text-muted-foreground">
              Enter your credentials below to access the dashboard
            </p>
          </div>

          <LoginForm />

          <div className="text-center text-sm text-muted-foreground mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="font-semibold text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
