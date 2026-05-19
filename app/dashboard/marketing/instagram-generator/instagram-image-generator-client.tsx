"use client"

import * as React from "react"
import Image from "next/image"
import { Download, ImagePlus, Loader2, Sparkles, UploadCloud } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type ImageFormat = "feed" | "portrait" | "story"

type GeneratedImageResult = {
  image: string
  mimeType: string
  width: number
  height: number
  prompt: string
  enhancedPrompt: string
}

type UploadedAsset = {
  url: string
  filename: string
  contentType: string
  width: number
  height: number
  size: number
}

type Holiday = {
  date: string
  name: string
  is_national_holiday: boolean
}

type VisualStyle = "Modern & Clean" | "Elegant & Luxury" | "Playful & Vibrant" | "Corporate & Professional" | "Minimalist"

const contentTypes = [
  "Ucapan ulang tahun customer",
  "Edukasi",
  "Pencapaian perusahaan",
  "Event perusahaan",
  "Promosi produk",
  "Hari Nasional",
] as const

const visualStyles: VisualStyle[] = [
  "Modern & Clean",
  "Elegant & Luxury",
  "Playful & Vibrant",
  "Corporate & Professional",
  "Minimalist",
]

function formatDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(`${date}T00:00:00+08:00`))
}

const defaultVisualStyleByContentType: Record<(typeof contentTypes)[number], VisualStyle> = {
  "Ucapan ulang tahun customer": "Elegant & Luxury",
  Edukasi: "Modern & Clean",
  "Pencapaian perusahaan": "Corporate & Professional",
  "Event perusahaan": "Playful & Vibrant",
  "Promosi produk": "Elegant & Luxury",
  "Hari Nasional": "Corporate & Professional",
}

const promptTemplates: Record<(typeof contentTypes)[number], Record<VisualStyle, string>> = {
  "Ucapan ulang tahun customer": {
    "Modern & Clean": `Content focus: Ucapan selamat ulang tahun untuk [NAMA CUSTOMER/PERUSAHAAN] dari PT Chitra Paratama.
Headline text: "Selamat Ulang Tahun"
Brand/Source: "PT Chitra Paratama"
Visual style: modern, clean layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use clean iconography and structured information hierarchy.
Additional elements: [ELEMEN TAMBAHAN MISAL: KUE, PITA, BACKGROUND KANTOR].
Variant note: Include a professional illustration or photo integrated naturally into the design.`,
    "Elegant & Luxury": `Content focus: Ucapan selamat ulang tahun untuk [NAMA CUSTOMER/PERUSAHAAN] dari PT Chitra Paratama.
Headline text: "Selamat Ulang Tahun"
Brand/Source: "PT Chitra Paratama"
Visual style: elegant, luxury, and sophisticated layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use premium textures, subtle background patterns, and balanced composition.
Additional elements: [ELEMEN TAMBAHAN MISAL: KUE, PITA, BACKGROUND KANTOR].
Variant note: Include a professional illustration or photo integrated naturally into the design.`,
    "Playful & Vibrant": `Content focus: Ucapan selamat ulang tahun untuk [NAMA CUSTOMER/PERUSAHAAN] dari PT Chitra Paratama.
Headline text: "Selamat Ulang Tahun"
Brand/Source: "PT Chitra Paratama"
Visual style: playful, vibrant, and energetic layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use friendly shapes, bright accents, and dynamic composition.
Additional elements: [ELEMEN TAMBAHAN MISAL: KUE, PITA, BACKGROUND KANTOR].
Variant note: Include a professional illustration or photo integrated naturally into the design.`,
    "Corporate & Professional": `Content focus: Ucapan selamat ulang tahun untuk [NAMA CUSTOMER/PERUSAHAAN] dari PT Chitra Paratama.
Headline text: "Selamat Ulang Tahun"
Brand/Source: "PT Chitra Paratama"
Visual style: corporate, professional, and trustworthy layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use structured grids, clean lines, and business-appropriate composition.
Additional elements: [ELEMEN TAMBAHAN MISAL: KUE, PITA, BACKGROUND KANTOR].
Variant note: Include a professional illustration or photo integrated naturally into the design.`,
    Minimalist: `Content focus: Ucapan selamat ulang tahun untuk [NAMA CUSTOMER/PERUSAHAAN] dari PT Chitra Paratama.
Headline text: "Selamat Ulang Tahun"
Brand/Source: "PT Chitra Paratama"
Visual style: minimalist, simple, and clean layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use plenty of whitespace, simple geometry, and high contrast.
Additional elements: [ELEMEN TAMBAHAN MISAL: KUE, PITA, BACKGROUND KANTOR].
Variant note: Include a professional illustration or photo integrated naturally into the design.`,
  },
  Edukasi: {
    "Modern & Clean": `Content focus: Educational post about [TOPIK EDUKASI] for [TARGET AUDIENCE].
Headline text: "[HEADLINE EDUKASI]"
Brand/Source: "PT Chitra Paratama"
Visual style: modern, clean layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use clean iconography, data visualization elements, and structured information hierarchy.
Additional elements: [ELEMEN TAMBAHAN].
Variant note: Include a professional photo of a person wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    "Elegant & Luxury": `Content focus: Educational post about [TOPIK EDUKASI] for [TARGET AUDIENCE].
Headline text: "[HEADLINE EDUKASI]"
Brand/Source: "PT Chitra Paratama"
Visual style: elegant, luxury, and sophisticated layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use premium textures, data visualization elements, and structured information hierarchy. Include subtle background patterns.
Additional elements: [ELEMEN TAMBAHAN].
Variant note: Include a professional photo of a person wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    "Playful & Vibrant": `Content focus: Educational post about [TOPIK EDUKASI] for [TARGET AUDIENCE].
Headline text: "[HEADLINE EDUKASI]"
Brand/Source: "PT Chitra Paratama"
Visual style: playful, vibrant, and engaging layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use bold typography, dynamic data visualization, and structured information hierarchy.
Additional elements: [ELEMEN TAMBAHAN].
Variant note: Include a professional photo of a person wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    "Corporate & Professional": `Content focus: Educational post about [TOPIK EDUKASI] for [TARGET AUDIENCE].
Headline text: "[HEADLINE EDUKASI]"
Brand/Source: "PT Chitra Paratama"
Visual style: corporate, professional, and authoritative layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use business iconography, formal data visualization, and strict information hierarchy.
Additional elements: [ELEMEN TAMBAHAN].
Variant note: Include a professional photo of a person wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    Minimalist: `Content focus: Educational post about [TOPIK EDUKASI] for [TARGET AUDIENCE].
Headline text: "[HEADLINE EDUKASI]"
Brand/Source: "PT Chitra Paratama"
Visual style: minimalist, highly focused layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use simple data visualization elements, abundant whitespace, and strict information hierarchy.
Additional elements: [ELEMEN TAMBAHAN].
Variant note: Include a professional photo of a person wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
  },
  "Pencapaian perusahaan": {
    "Modern & Clean": `Content focus: Company milestone or achievement about [DETAIL PENCAPAIAN] for [TARGET AUDIENCE].
Headline text: "[HEADLINE PENCAPAIAN]"
Brand/Source: "PT Chitra Paratama"
Visual style: modern, clean layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use bold numbers, clean iconography, and a structured layout that highlights the milestone.
Additional elements: [ELEMEN TAMBAHAN MISAL: TROFI, GRAFIK NAIK, GEDUNG KANTOR].
Variant note: Include a professional photo of a team wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    "Elegant & Luxury": `Content focus: Company milestone or achievement about [DETAIL PENCAPAIAN] for [TARGET AUDIENCE].
Headline text: "[HEADLINE PENCAPAIAN]"
Brand/Source: "PT Chitra Paratama"
Visual style: elegant, luxury, and sophisticated layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use premium typography, gold/silver accents if applicable, and a prestigious composition.
Additional elements: [ELEMEN TAMBAHAN MISAL: TROFI, GRAFIK NAIK, GEDUNG KANTOR].
Variant note: Include a professional photo of a team wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    "Playful & Vibrant": `Content focus: Company milestone or achievement about [DETAIL PENCAPAIAN] for [TARGET AUDIENCE].
Headline text: "[HEADLINE PENCAPAIAN]"
Brand/Source: "PT Chitra Paratama"
Visual style: playful, vibrant, and celebratory layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use dynamic shapes, energetic composition, and a festive mood.
Additional elements: [ELEMEN TAMBAHAN MISAL: TROFI, GRAFIK NAIK, GEDUNG KANTOR].
Variant note: Include a professional photo of a team wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    "Corporate & Professional": `Content focus: Company milestone or achievement about [DETAIL PENCAPAIAN] for [TARGET AUDIENCE].
Headline text: "[HEADLINE PENCAPAIAN]"
Brand/Source: "PT Chitra Paratama"
Visual style: corporate, professional, and prestigious layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use formal typography, solid business aesthetics, and strict grids.
Additional elements: [ELEMEN TAMBAHAN MISAL: TROFI, GRAFIK NAIK, GEDUNG KANTOR].
Variant note: Include a professional photo of a team wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    Minimalist: `Content focus: Company milestone or achievement about [DETAIL PENCAPAIAN] for [TARGET AUDIENCE].
Headline text: "[HEADLINE PENCAPAIAN]"
Brand/Source: "PT Chitra Paratama"
Visual style: minimalist, clean layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Focus entirely on the milestone number/text with ample whitespace.
Additional elements: [ELEMEN TAMBAHAN MISAL: TROFI, GRAFIK NAIK, GEDUNG KANTOR].
Variant note: Include a professional photo of a team wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
  },
  "Event perusahaan": {
    "Modern & Clean": `Content focus: Company event announcement or coverage about [NAMA EVENT] for [TARGET AUDIENCE].
Headline text: "[HEADLINE EVENT]"
Brand/Source: "PT Chitra Paratama"
Visual style: modern, clean layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use dynamic angles, clear date/time layout, and structured event information.
Additional elements: [ELEMEN TAMBAHAN MISAL: MIC, PANGGUNG, TIKET].
Variant note: Include a professional photo of the event with people wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    "Elegant & Luxury": `Content focus: Company event announcement or coverage about [NAMA EVENT] for [TARGET AUDIENCE].
Headline text: "[HEADLINE EVENT]"
Brand/Source: "PT Chitra Paratama"
Visual style: elegant, luxury, and exclusive layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use premium textures, sophisticated typography, and a VIP atmosphere.
Additional elements: [ELEMEN TAMBAHAN MISAL: MIC, PANGGUNG, TIKET].
Variant note: Include a professional photo of the event with people wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    "Playful & Vibrant": `Content focus: Company event announcement or coverage about [NAMA EVENT] for [TARGET AUDIENCE].
Headline text: "[HEADLINE EVENT]"
Brand/Source: "PT Chitra Paratama"
Visual style: playful, vibrant, and exciting layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use bold graphics, high energy, and inviting composition.
Additional elements: [ELEMEN TAMBAHAN MISAL: MIC, PANGGUNG, TIKET].
Variant note: Include a professional photo of the event with people wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    "Corporate & Professional": `Content focus: Company event announcement or coverage about [NAMA EVENT] for [TARGET AUDIENCE].
Headline text: "[HEADLINE EVENT]"
Brand/Source: "PT Chitra Paratama"
Visual style: corporate, professional, and formal layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use clean business graphics, structured agenda layout, and authoritative tone.
Additional elements: [ELEMEN TAMBAHAN MISAL: MIC, PANGGUNG, TIKET].
Variant note: Include a professional photo of the event with people wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    Minimalist: `Content focus: Company event announcement or coverage about [NAMA EVENT] for [TARGET AUDIENCE].
Headline text: "[HEADLINE EVENT]"
Brand/Source: "PT Chitra Paratama"
Visual style: minimalist, modern layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Focus purely on the event title and essential details with a clean background.
Additional elements: [ELEMEN TAMBAHAN MISAL: MIC, PANGGUNG, TIKET].
Variant note: Include a professional photo of the event with people wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
  },
  "Promosi produk": {
    "Modern & Clean": `Content focus: Product promotion for [NAMA PRODUK/LAYANAN] aimed at [TARGET AUDIENCE].
Headline text: "[HEADLINE PROMOSI]"
Brand/Source: "PT Chitra Paratama"
Visual style: modern, clean layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use sharp product focus, clear features hierarchy, and sleek typography.
Additional elements: [ELEMEN TAMBAHAN MISAL: BAN, ALAT BERAT, SERVIS].
Variant note: Include a professional photo of the product or service in action with personnel wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    "Elegant & Luxury": `Content focus: Product promotion for [NAMA PRODUK/LAYANAN] aimed at [TARGET AUDIENCE].
Headline text: "[HEADLINE PROMOSI]"
Brand/Source: "PT Chitra Paratama"
Visual style: elegant, luxury, and premium layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use high-end aesthetics, dramatic lighting, and sophisticated composition.
Additional elements: [ELEMEN TAMBAHAN MISAL: BAN, ALAT BERAT, SERVIS].
Variant note: Include a professional photo of the product or service in action with personnel wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    "Playful & Vibrant": `Content focus: Product promotion for [NAMA PRODUK/LAYANAN] aimed at [TARGET AUDIENCE].
Headline text: "[HEADLINE PROMOSI]"
Brand/Source: "PT Chitra Paratama"
Visual style: playful, vibrant, and eye-catching layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use dynamic bursts, strong contrast, and an inviting promotional feel.
Additional elements: [ELEMEN TAMBAHAN MISAL: BAN, ALAT BERAT, SERVIS].
Variant note: Include a professional photo of the product or service in action with personnel wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    "Corporate & Professional": `Content focus: Product promotion for [NAMA PRODUK/LAYANAN] aimed at [TARGET AUDIENCE].
Headline text: "[HEADLINE PROMOSI]"
Brand/Source: "PT Chitra Paratama"
Visual style: corporate, professional, and reliable layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use industrial/business aesthetics, clear benefits list, and a trustworthy tone.
Additional elements: [ELEMEN TAMBAHAN MISAL: BAN, ALAT BERAT, SERVIS].
Variant note: Include a professional photo of the product or service in action with personnel wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
    Minimalist: `Content focus: Product promotion for [NAMA PRODUK/LAYANAN] aimed at [TARGET AUDIENCE].
Headline text: "[HEADLINE PROMOSI]"
Brand/Source: "PT Chitra Paratama"
Visual style: minimalist, ultra-clean layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use negative space to make the product the sole hero of the visual.
Additional elements: [ELEMEN TAMBAHAN MISAL: BAN, ALAT BERAT, SERVIS].
Variant note: Include a professional photo of the product or service in action with personnel wearing Chitra Paratama official safety workwear: a single integrated TWO-TONE long sleeve work shirt (NOT a vest), FULL SLEEVES in DARK NAVY BLUE, upper chest/shoulders in NEON LIME GREEN, with SILVER REFLECTIVE STRIPES on left and right shoulders, one horizontal SILVER REFLECTIVE TAPE across the middle stomach (bordering green and navy), full button-down collar, two flap chest pockets on the neon green area, and a small Chitra Paratama logo patch on the left chest pocket integrated naturally into the design.`,
  },
  "Hari Nasional": {
    "Modern & Clean": `Content focus: National holiday greeting for [NAMA HARI NASIONAL].
Headline text: "Selamat [NAMA HARI NASIONAL]"
Brand/Source: "PT Chitra Paratama"
Visual style: modern, clean layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use relevant national/cultural symbols with a contemporary design approach.
Additional elements: [ELEMEN TAMBAHAN SESUAI HARI RAYA].
Variant note: Include a professional illustration or photo relevant to the holiday integrated naturally into the design.`,
    "Elegant & Luxury": `Content focus: National holiday greeting for [NAMA HARI NASIONAL].
Headline text: "Selamat [NAMA HARI NASIONAL]"
Brand/Source: "PT Chitra Paratama"
Visual style: elegant, luxury, and respectful layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use premium textures, sophisticated cultural motifs, and a distinguished atmosphere.
Additional elements: [ELEMEN TAMBAHAN SESUAI HARI RAYA].
Variant note: Include a professional illustration or photo relevant to the holiday integrated naturally into the design.`,
    "Playful & Vibrant": `Content focus: National holiday greeting for [NAMA HARI NASIONAL].
Headline text: "Selamat [NAMA HARI NASIONAL]"
Brand/Source: "PT Chitra Paratama"
Visual style: playful, vibrant, and festive layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use bright cultural graphics, joyful energy, and celebratory composition.
Additional elements: [ELEMEN TAMBAHAN SESUAI HARI RAYA].
Variant note: Include a professional illustration or photo relevant to the holiday integrated naturally into the design.`,
    "Corporate & Professional": `Content focus: National holiday greeting for [NAMA HARI NASIONAL].
Headline text: "Selamat [NAMA HARI NASIONAL]"
Brand/Source: "PT Chitra Paratama"
Visual style: corporate, professional, and formal layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Use official business greetings, clean cultural accents, and a respectful tone.
Additional elements: [ELEMEN TAMBAHAN SESUAI HARI RAYA].
Variant note: Include a professional illustration or photo relevant to the holiday integrated naturally into the design.`,
    Minimalist: `Content focus: National holiday greeting for [NAMA HARI NASIONAL].
Headline text: "Selamat [NAMA HARI NASIONAL]"
Brand/Source: "PT Chitra Paratama"
Visual style: minimalist, modern layout with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. Focus purely on a single strong cultural icon and the greeting text with ample whitespace.
Additional elements: [ELEMEN TAMBAHAN SESUAI HARI RAYA].
Variant note: Include a professional illustration or photo relevant to the holiday integrated naturally into the design.`,
  },
}

function getPromptTemplate(contentType: (typeof contentTypes)[number], visualStyle: VisualStyle) {
  return promptTemplates[contentType][visualStyle]
}

export function InstagramImageGeneratorClient() {
  const [contentType, setContentType] = React.useState<(typeof contentTypes)[number]>("Edukasi")
  const [visualStyle, setVisualStyle] = React.useState<VisualStyle>(defaultVisualStyleByContentType.Edukasi)
  const [prompt, setPrompt] = React.useState(getPromptTemplate("Edukasi", defaultVisualStyleByContentType.Edukasi))
  const [format, setFormat] = React.useState<ImageFormat>("portrait")
  const [uploadedAssets, setUploadedAssets] = React.useState<UploadedAsset[]>([])
  const [nearestHoliday, setNearestHoliday] = React.useState<Holiday | null>(null)
  const [isLoadingHoliday, setIsLoadingHoliday] = React.useState(false)
  const [result, setResult] = React.useState<GeneratedImageResult | null>(null)
  const [variationResults, setVariationResults] = React.useState<GeneratedImageResult[]>([])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isEnhancing, setIsEnhancing] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (contentType !== "Hari Nasional") return
    let mounted = true
    const controller = new AbortController()
    
    queueMicrotask(() => {
      if (mounted) setIsLoadingHoliday(true)
    })
    
    fetch("/api/national-holidays", { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { nearestHoliday?: Holiday; error?: string }) => {
        if (!mounted) return
        if (!data.nearestHoliday) throw new Error(data.error || "Data Hari Nasional tidak tersedia")
        setNearestHoliday(data.nearestHoliday)
        
        // Use the current visual style template for Hari Nasional and replace the placeholders
        const baseTemplate = getPromptTemplate("Hari Nasional", visualStyle)
        const updatedPrompt = baseTemplate
          .replace(/\[NAMA HARI NASIONAL\]/g, data.nearestHoliday.name)
          .replace(/\[ELEMEN TAMBAHAN SESUAI HARI RAYA\]/g, "Elemen relevan untuk " + data.nearestHoliday.name)
        
        setPrompt(updatedPrompt)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : "Gagal mengambil Hari Nasional terdekat"
        setError(message)
        toast.error(message)
      })
      .finally(() => {
        if (mounted) setIsLoadingHoliday(false)
      })
      
    return () => {
      mounted = false
      controller.abort()
    }
  }, [contentType, visualStyle])

  const generateImage = async () => {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      setError("Prompt wajib diisi sebelum generate gambar")
      return
    }

    setIsGenerating(true)
    setError(null)
    setResult(null)
    setVariationResults([])

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 180000) // 3 mins timeout

    try {
      const response = await fetch("/api/instagram-image-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          format,
          contentType,
          visualStyle,
          referenceAssets: uploadedAssets,
        }),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => null) as GeneratedImageResult & { error?: string } | null
      if (!response.ok || !data) {
        throw new Error(data?.error || "Gagal generate gambar")
      }
      setResult(data)
      toast.success("Gambar Instagram berhasil dibuat")
    } catch (err) {
      const message = err instanceof Error ? (err.name === 'AbortError' ? 'Waktu proses habis (timeout)' : err.message) : "Gagal generate gambar"
      setError(message)
      toast.error(message)
    } finally {
      clearTimeout(timeout)
      setIsGenerating(false)
    }
  }

  const generateVariations = async () => {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      setError("Prompt wajib diisi sebelum membuat variasi")
      return
    }

    setIsGenerating(true)
    setError(null)
    setResult(null)
    setVariationResults([])

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 240000) // 4 mins timeout

    try {
      const response = await fetch("/api/instagram-image-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          format,
          contentType,
          visualStyle,
          referenceAssets: uploadedAssets,
          mode: "variations",
        }),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => null) as { variations?: GeneratedImageResult[]; error?: string } | null
      if (!response.ok || data?.variations?.length !== 2) {
        throw new Error(data?.error || "Gagal membuat tepat 2 variasi gambar")
      }
      setVariationResults(data.variations)
      toast.success("2 variasi gambar berhasil dibuat")
    } catch (err) {
      const message = err instanceof Error ? (err.name === 'AbortError' ? 'Waktu proses habis (timeout)' : err.message) : "Gagal membuat variasi gambar"
      setError(message)
      toast.error(message)
    } finally {
      clearTimeout(timeout)
      setIsGenerating(false)
    }
  }

  const enhancePrompt = async () => {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      setError("Prompt wajib diisi sebelum enhancement")
      return
    }

    setIsEnhancing(true)
    setError(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000) // 1 min timeout

    try {
      const response = await fetch("/api/instagram-prompt-enhancer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          format,
          contentType,
          visualStyle,
          referenceAssets: uploadedAssets,
        }),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => null) as { enhancedPrompt?: string; error?: string } | null
      if (!response.ok || !data?.enhancedPrompt) {
        throw new Error(data?.error || "Gagal meningkatkan prompt")
      }
      setPrompt(data.enhancedPrompt)
      toast.success("Prompt berhasil ditingkatkan oleh spesialis Instagram")
    } catch (err) {
      const message = err instanceof Error ? (err.name === 'AbortError' ? 'Waktu proses habis (timeout)' : err.message) : "Gagal meningkatkan prompt"
      setError(message)
      toast.error(message)
    } finally {
      clearTimeout(timeout)
      setIsEnhancing(false)
    }
  }

  const onFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    event.target.value = ""
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"])
    const maxSize = 8 * 1024 * 1024
    const validFiles = selectedFiles.filter((file) => {
      if (!allowedTypes.has(file.type)) {
        toast.error(`${file.name}: format tidak didukung. Gunakan JPG, PNG, atau WebP`)
        return false
      }
      if (file.size > maxSize) {
        toast.error(`${file.name}: ukuran melebihi 8 MB`)
        return false
      }
      return true
    }).slice(0, Math.max(0, 8 - uploadedAssets.length))

    if (validFiles.length === 0) return

    setIsUploading(true)
    setError(null)

    try {
      const results = await Promise.allSettled(validFiles.map(async (file) => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30000)
        try {
          const formData = new FormData()
          formData.append("file", file)
          const response = await fetch("/api/instagram-assets", {
            method: "POST",
            body: formData,
            signal: controller.signal,
          })
          const data = await response.json().catch(() => null) as UploadedAsset & { success?: boolean; error?: string } | null
          if (!response.ok || !data?.success) {
            throw new Error(data?.error || `${file.name}: upload gagal`)
          }
          return {
            url: data.url,
            filename: data.filename,
            contentType: data.contentType,
            width: data.width,
            height: data.height,
            size: data.size,
          } as UploadedAsset
        } finally {
          clearTimeout(timeout)
        }
      }))

      const uploaded: UploadedAsset[] = []
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status === "fulfilled") {
          uploaded.push(result.value)
        } else {
          const message = result.reason instanceof Error ? result.reason.message : `${validFiles[i]?.name ?? "File"}: upload gagal`
          toast.error(message)
        }
      }

      if (uploaded.length > 0) {
        setUploadedAssets((current) => [...current, ...uploaded].slice(0, 8))
        toast.success(`${uploaded.length} gambar berhasil diunggah`)
      } else {
        setError("Semua file gagal diunggah. Periksa format dan ukuran file.")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload gambar gagal"
      setError(message)
      toast.error(message)
    } finally {
      setIsUploading(false)
    }
  }

  const removeAsset = (url: string) => {
    setUploadedAssets((current) => current.filter((asset) => asset.url !== url))
  }

  const downloadImage = (image = result?.image, suffix: string = format) => {
    if (!image) return
    const link = document.createElement("a")
    link.href = image
    link.download = `pt-chitra-paratama-instagram-${suffix}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Sparkles className="size-4" />
          Instagram Content Generator
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Generate Image Instagram PT Chitra Paratama</h1>
          <p className="text-muted-foreground">Buat visual feed, portrait, atau story dengan logo dan footer perusahaan otomatis.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Konfigurasi Konten</CardTitle>
            <CardDescription>Isi prompt, pilih kebutuhan konten, dan unggah referensi visual bila ada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2">
              <Label>Kategori konten</Label>
              <Select
                value={contentType}
                onValueChange={(value) => {
                  const newContentType = value as (typeof contentTypes)[number]
                  const newVisualStyle = defaultVisualStyleByContentType[newContentType]
                  setContentType(newContentType)
                  setVisualStyle(newVisualStyle)
                  if (newContentType !== "Hari Nasional") {
                    setPrompt(getPromptTemplate(newContentType, newVisualStyle))
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {contentTypes.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contentType === "Hari Nasional" && (
                <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                  {isLoadingHoliday ? "Mengambil Hari Nasional terdekat..." : nearestHoliday ? `Hari Nasional terdekat: ${nearestHoliday.name} (${formatDate(nearestHoliday.date)})` : "Hari Nasional belum tersedia"}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Gaya Visual</Label>
              <Select
                value={visualStyle}
                onValueChange={(value) => {
                  const newVisualStyle = value as VisualStyle
                  setVisualStyle(newVisualStyle)
                  if (contentType !== "Hari Nasional") {
                    setPrompt(getPromptTemplate(contentType, newVisualStyle))
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih gaya visual" />
                </SelectTrigger>
                <SelectContent>
                  {visualStyles.map((style) => (
                    <SelectItem key={style} value={style}>{style}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Gaya visual menentukan nuansa desain. Prompt di bawah akan otomatis disesuaikan dan bisa diedit lebih lanjut.</p>
            </div>

            <div className="grid gap-2">
              <Label>Ukuran desain</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={format === "portrait" ? "default" : "outline"} onClick={() => setFormat("portrait")} className="h-auto flex-col gap-1 py-3">
                  <span>Feed 4:5</span>
                  <span className="text-xs font-normal opacity-80">1080 × 1350</span>
                </Button>
                <Button type="button" variant={format === "story" ? "default" : "outline"} onClick={() => setFormat("story")} className="h-auto flex-col gap-1 py-3">
                  <span>Story 9:16</span>
                  <span className="text-xs font-normal opacity-80">1080 × 1920</span>
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Prompt</Label>
                <Button type="button" variant="outline" size="sm" onClick={enhancePrompt} disabled={isEnhancing || isGenerating || isUploading}>
                  {isEnhancing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {isEnhancing ? "Enhancing..." : "Enhance Prompt"}
                </Button>
              </div>
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-40"
                placeholder="Tulis tema konten Instagram yang ingin dibuat"
              />
              <p className="text-xs text-muted-foreground">Prompt bisa ditingkatkan memakai spesialis Instagram dan ahli grafik desain, lalu dipakai untuk generate gambar final.</p>
            </div>

            <div className="grid gap-2">
              <Label>Upload gambar referensi atau aset</Label>
              <div className="rounded-xl border border-dashed p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <UploadCloud className="size-5" />
                  </div>
                  <div className="flex-1">
                    <Input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFilesChange} disabled={isUploading || uploadedAssets.length >= 8} />
                    <p className="mt-2 text-xs text-muted-foreground">Maksimal 8 gambar, JPG/PNG/WebP, ukuran maksimal 8 MB per file. File dipakai sebagai image reference untuk proses generate, bukan ditempel manual di atas hasil.</p>
                  </div>
                </div>
                {isUploading && <p className="mt-3 text-xs text-muted-foreground">Sedang mengunggah dan memvalidasi gambar...</p>}
                {uploadedAssets.length > 0 && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {uploadedAssets.map((asset) => (
                      <div key={asset.url} className="group overflow-hidden rounded-xl border bg-background shadow-sm">
                        <div className="relative aspect-[4/3] bg-muted">
                          <Image src={asset.url} alt={asset.filename} fill className="object-contain p-2" unoptimized />
                          <button type="button" onClick={() => removeAsset(asset.url)} className="absolute right-2 top-2 rounded bg-black/75 px-2 py-1 text-xs text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">Hapus</button>
                        </div>
                        <div className="space-y-1 p-2 text-xs">
                          <p className="truncate font-medium">{asset.filename}</p>
                          <p className="text-muted-foreground">{asset.width} × {asset.height}px</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={generateImage} disabled={isGenerating || isEnhancing || isUploading} className="w-full">
                {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                {isGenerating ? "Sedang generate gambar..." : "Generate Gambar"}
              </Button>
              <Button onClick={generateVariations} disabled={isGenerating || isEnhancing || isUploading} variant="secondary" className="w-full">
                {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Buat 2 Variasi
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview Final</CardTitle>
            <CardDescription>Gambar final sudah berisi logo, footer informasi perusahaan, dan resolusi siap unggah.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex min-h-[520px] items-center justify-center rounded-xl border bg-muted/40 p-4">
              {variationResults.length === 2 ? (
                <div className="grid w-full gap-4 lg:grid-cols-2">
                  {variationResults.map((variation, index) => (
                    <div key={`${variation.prompt}-${index}`} className="space-y-2">
                      <div className="text-center text-sm font-medium">Variasi {index + 1}</div>
                      <Image
                        src={variation.image}
                        alt={`Variasi ${index + 1} gambar Instagram PT Chitra Paratama`}
                        width={variation.width || 1080}
                        height={variation.height || 1080}
                        className="max-h-[560px] w-auto rounded-lg object-contain shadow-xl"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              ) : result ? (
                <Image
                  src={result.image}
                  alt="Preview gambar Instagram PT Chitra Paratama"
                  width={result.width || 1080}
                  height={result.height || 1080}
                  className="max-h-[720px] w-auto rounded-lg object-contain shadow-xl"
                  unoptimized
                />
              ) : (
                <div className="flex max-w-md flex-col items-center gap-3 text-center text-muted-foreground">
                  <ImagePlus className="size-12" />
                  <div>
                    <p className="font-medium text-foreground">Belum ada gambar</p>
                    <p className="text-sm">Isi prompt dan tekan generate untuk melihat preview hasil akhir.</p>
                  </div>
                </div>
              )}
            </div>

            {variationResults.length === 2 && (
              <div className="flex flex-col gap-3 rounded-xl border p-4">
                <div className="grid gap-1 text-sm">
                  <p><span className="font-medium">Output:</span> 2 variasi gambar</p>
                  <p><span className="font-medium">Resolusi:</span> {variationResults[0]?.width} × {variationResults[0]?.height}px</p>
                  <p><span className="font-medium">Format:</span> PNG</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {variationResults.map((variation, index) => (
                    <Button key={`download-${index}`} onClick={() => downloadImage(variation.image, `${format}-variasi-${index + 1}`)} variant="secondary" className="w-full sm:w-fit">
                      <Download className="size-4" />
                      Download Variasi {index + 1}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {result && (
              <div className="flex flex-col gap-3 rounded-xl border p-4">
                <div className="grid gap-1 text-sm">
                  <p><span className="font-medium">Resolusi:</span> {result.width} × {result.height}px</p>
                  <p><span className="font-medium">Format:</span> PNG</p>
                </div>
                <Button onClick={() => downloadImage()} variant="secondary" className="w-full sm:w-fit">
                  <Download className="size-4" />
                  Download PNG
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
