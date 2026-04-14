import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-context";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const parkinsans = localFont({
  variable: "--font-parkinsans",
  display: "swap",
  src: [
    {
      path: "./fonts/parkinsans/Parkinsans-300.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/parkinsans/Parkinsans-400.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/parkinsans/Parkinsans-500.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/parkinsans/Parkinsans-600.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/parkinsans/Parkinsans-700.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/parkinsans/Parkinsans-800.ttf",
      weight: "800",
      style: "normal",
    },
  ],
});

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "One Chitra - All In One Apps Chitra Paratama",
  description: "A modern management system for Chitra Paratama",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "One Chitra",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${parkinsans.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <Providers>
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
