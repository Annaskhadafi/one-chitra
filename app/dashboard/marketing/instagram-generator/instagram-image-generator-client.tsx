﻿"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Clipboard, Download, History as HistoryIcon, ImagePlus, Loader2, ShieldCheck, Sparkles, UploadCloud } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

type OverlayFormat = "feed" | "story"
type OverlayVariant = "standard" | "white"

type OverlayImageResult = {
  image: string
  mimeType: string
  width: number
  height: number
  format: OverlayFormat
  overlayVariant: OverlayVariant
  template: string
}

type LogoFixerResult = {
  image: string
  mimeType: string
  width: number
  height: number
  sourceName: string
  logoSource: string
  prompt: string
}

type LogoFixerSource = {
  image: string
  name: string
  width?: number
  height?: number
}

const overlayVariantLabels: Record<OverlayVariant, string> = {
  standard: "Standar",
  white: "Putih",
}

function getOverlayTemplateName(format: OverlayFormat | ImageFormat, variant: OverlayVariant) {
  if (variant === "white") return format === "story" ? "Story putih.png" : "feed putih.png"
  return format === "story" ? "Story.png" : "feed.png"
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

type VisualStyle = "Modern & Clean" | "Elegant & Luxury" | "Playful & Vibrant" | "Corporate & Professional" | "Minimalist" | "Vectorize Minimalis" | "Vector Kartun Simple" | "Vector Detail" | "Style Retro"

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
  "Vectorize Minimalis",
  "Vector Kartun Simple",
  "Vector Detail",
  "Style Retro",
]

const wearpackStylePrompt = "Tampilkan pekerja/karyawan memakai wearpack safety TWO-TONE resmi: lengan BIRU NAVY GELAP (#002D56), panel dada/bahu atas HIJAU NEON (#8DC63F) berada DI ATAS strip reflektif atas, dua strip reflektif silver horizontal mengelilingi badan dengan strip utama tepat di atas pusar/udel, dan area perut sampai bawah DI BAWAH strip bawah berwarna BIRU NAVY GELAP (#002D56). WAJIB: di atas saku dada kiri wearpack, tempel patch logo Chitra Paratama berbentuk persegi panjang kecil dengan BACKGROUND PUTIH SOLID di belakang logo — logo CP berwarna asli di atas kotak putih, dijahit/bordir natural ke kain wearpack, terlihat jelas dan kontras. Patch ini harus tampak seperti name tag atau label bordir resmi yang menempel di atas saku, bukan stiker mengambang. Gunakan warna brand: Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56. Komposisi profesional, pencahayaan natural."

const galleryLogoPrompt = "Tampilkan galeri produk ban atau suasana kerja lapangan PT Chitra Paratama dengan pekerja memakai wearpack safety TWO-TONE resmi: lengan BIRU NAVY GELAP (#002D56), panel dada/bahu atas HIJAU NEON (#8DC63F) berada DI ATAS strip reflektif atas, dua strip reflektif silver horizontal mengelilingi badan dengan strip utama tepat di atas pusar/udel, dan area perut sampai bawah DI BAWAH strip bawah berwarna BIRU NAVY GELAP (#002D56). WAJIB: di atas saku dada kiri wearpack, tempel patch logo Chitra Paratama berbentuk persegi panjang kecil dengan BACKGROUND PUTIH SOLID di belakang logo — logo CP berwarna asli di atas kotak putih, dijahit/bordir natural ke kain wearpack, terlihat jelas dan kontras. Patch ini harus tampak seperti name tag atau label bordir resmi yang menempel di atas saku, bukan stiker mengambang. Gunakan warna brand: Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56. Komposisi profesional, pencahayaan natural."

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

const WEARPACK = "person wearing official PT Chitra Paratama wearpack safety TWO-TONE resmi: lengan BIRU NAVY GELAP (#002D56), panel dada/bahu atas HIJAU NEON (#8DC63F) berada DI ATAS strip reflektif atas, dua strip reflektif silver horizontal mengelilingi badan dengan strip utama tepat di atas pusar/udel, dan area perut sampai bawah DI BAWAH strip bawah berwarna BIRU NAVY GELAP (#002D56). WAJIB: di atas saku dada kiri wearpack, tempel patch logo Chitra Paratama berbentuk persegi panjang kecil dengan BACKGROUND PUTIH SOLID di belakang logo — logo CP berwarna asli di atas kotak putih, dijahit/bordir natural ke kain wearpack, terlihat jelas dan kontras. Patch ini harus tampak seperti name tag atau label bordir resmi yang menempel di atas saku, bukan stiker mengambang. Gunakan warna brand: Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56. Komposisi profesional, pencahayaan natural."
const BRAND_COLORS = "Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56)"
const SAFE_ZONE = "SAFE ZONE: keep minimum 200px margin from the TOP edge (top-left ~320x180px area is covered by logo overlay) and minimum 180px margin from the BOTTOM edge (covered by footer overlay). Place ALL headlines and key elements in the center zone only — never flush against top or bottom edges."
const RETRO_STYLE_PROMPT = "Style Retro — retro poster, gouache illustration, fisheye perspective, tiny planet, heroic composition, editorial illustration, travel poster, grain texture, stylized environment, dynamic low angle. Use warm vintage tones balanced with Chitra Paratama brand colors, bold poster composition, hand-painted texture, and cinematic perspective while keeping text readable."

const promptTemplates: Record<(typeof contentTypes)[number], Partial<Record<VisualStyle, string>>> = {
  "Ucapan ulang tahun customer": {
    "Modern & Clean": `Content focus: Birthday greeting for a valued customer or partner company of PT Chitra Paratama. Celebrate their special day with a warm, professional message.
Headline text: "Selamat Ulang Tahun! Semoga sukses selalu bersama PT Chitra Paratama."
Brand/Source: "PT Chitra Paratama"
Visual style: modern, clean layout with ${BRAND_COLORS} color scheme. Use clean iconography, celebratory accents (confetti, ribbons, stars), and structured composition.
Additional elements: birthday cake, ribbon, balloons, subtle bokeh background in brand colors.
Variant note: Include a warm celebratory illustration integrated naturally. ${SAFE_ZONE}`,
    "Elegant & Luxury": `Content focus: Birthday greeting for a valued customer or partner company of PT Chitra Paratama. Celebrate their special day with an elegant, premium message.
Headline text: "Selamat Ulang Tahun! Semoga sukses selalu bersama PT Chitra Paratama."
Brand/Source: "PT Chitra Paratama"
Visual style: elegant, luxury, and sophisticated layout with ${BRAND_COLORS} color scheme. Use gold accents, premium textures, subtle floral or geometric patterns, and balanced composition.
Additional elements: gold ribbon, elegant floral motif, soft bokeh, premium background texture.
Variant note: Include a premium celebratory illustration integrated naturally. ${SAFE_ZONE}`,
    "Playful & Vibrant": `Content focus: Birthday greeting for a valued customer or partner company of PT Chitra Paratama. Celebrate their special day with a fun, energetic message.
Headline text: "Selamat Ulang Tahun! Semoga sukses selalu bersama PT Chitra Paratama."
Brand/Source: "PT Chitra Paratama"
Visual style: playful, vibrant, and energetic layout with ${BRAND_COLORS} color scheme. Use bold shapes, confetti bursts, bright accents, and dynamic composition.
Additional elements: colorful balloons, confetti, party hat, bright celebratory background.
Variant note: Include a fun celebratory illustration integrated naturally. ${SAFE_ZONE}`,
    "Corporate & Professional": `Content focus: Birthday greeting for a valued customer or partner company of PT Chitra Paratama. Celebrate their special day with a professional, respectful message.
Headline text: "Selamat Ulang Tahun! Semoga sukses selalu bersama PT Chitra Paratama."
Brand/Source: "PT Chitra Paratama"
Visual style: corporate, professional, and trustworthy layout with ${BRAND_COLORS} color scheme. Use structured grids, clean lines, subtle celebratory accents, and business-appropriate composition.
Additional elements: subtle ribbon accent, clean geometric shapes, professional background.
Variant note: Include a professional celebratory illustration integrated naturally. ${SAFE_ZONE}`,
    Minimalist: `Content focus: Birthday greeting for a valued customer or partner company of PT Chitra Paratama. Celebrate their special day with a clean, minimal message.
Headline text: "Selamat Ulang Tahun! Semoga sukses selalu bersama PT Chitra Paratama."
Brand/Source: "PT Chitra Paratama"
Visual style: minimalist, simple, and clean layout with ${BRAND_COLORS} color scheme. Use plenty of whitespace, a single focal element, and high contrast typography.
Additional elements: single ribbon or star accent, clean solid background in brand color.
Variant note: Include a minimal celebratory illustration integrated naturally. ${SAFE_ZONE}`,
  },
  Edukasi: {
    "Modern & Clean": `Content focus: Educational post about tire safety, maintenance tips, or industry knowledge for fleet managers and procurement teams in Indonesia.
Headline text: "Tips Perawatan Ban yang Benar untuk Armada Anda"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: modern, clean layout with ${BRAND_COLORS} color scheme. Use clean iconography, infographic-style data visualization, numbered steps, and structured information hierarchy.
Additional elements: tire cross-section diagram, checklist icons, maintenance tools illustration.
Variant note: Include a ${WEARPACK} demonstrating the tip. ${SAFE_ZONE}`,
    "Elegant & Luxury": `Content focus: Educational post about premium tire technology or advanced fleet management for high-value clients in Indonesia.
Headline text: "Teknologi Ban Premium untuk Performa Armada Terbaik"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: elegant, luxury, and sophisticated layout with ${BRAND_COLORS} color scheme. Use premium textures, refined typography, subtle data visualization, and balanced composition.
Additional elements: premium tire close-up, technical diagram, sophisticated background texture.
Variant note: Include a ${WEARPACK} in a professional setting. ${SAFE_ZONE}`,
    "Playful & Vibrant": `Content focus: Educational post about tire safety facts or fun industry trivia for a broad audience on Instagram.
Headline text: "Tahukah Kamu? Fakta Menarik Seputar Ban Kendaraan"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: playful, vibrant, and engaging layout with ${BRAND_COLORS} color scheme. Use bold typography, dynamic icons, bright accent colors, and energetic composition.
Additional elements: fun tire illustration, bold fact callouts, dynamic background shapes.
Variant note: Include a ${WEARPACK} in an engaging pose. ${SAFE_ZONE}`,
    "Corporate & Professional": `Content focus: Educational post about fleet tire management best practices for corporate procurement and logistics managers.
Headline text: "Optimalkan Biaya Armada dengan Manajemen Ban yang Tepat"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: corporate, professional, and authoritative layout with ${BRAND_COLORS} color scheme. Use business iconography, formal data visualization, structured grid layout, and strict information hierarchy.
Additional elements: fleet vehicle silhouette, cost-saving chart, professional icons.
Variant note: Include a ${WEARPACK} in a corporate environment. ${SAFE_ZONE}`,
    Minimalist: `Content focus: Educational post with a single focused tire tip or safety fact for Instagram.
Headline text: "Satu Tips Ban Hari Ini: Cek Tekanan Ban Setiap Minggu"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: minimalist, highly focused layout with ${BRAND_COLORS} color scheme. Use abundant whitespace, a single bold headline, and one key visual element.
Additional elements: single tire icon or pressure gauge illustration, clean solid background.
Variant note: Include a minimal ${WEARPACK} illustration. ${SAFE_ZONE}`,
    "Vectorize Minimalis": `Content focus: Educational post about tire safety or maintenance presented as a clean vector infographic.
Headline text: "Panduan Singkat Perawatan Ban Armada"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: flat vector minimalist style with ${BRAND_COLORS} color scheme. Use simple geometric shapes, flat icons, clean lines, and minimal detail.
Additional elements: flat vector tire, wrench, checklist icons in brand colors.
Variant note: Include a flat vector ${WEARPACK} illustration. ${SAFE_ZONE}`,
    "Vector Kartun Simple": `Content focus: Educational post about tire safety presented as a friendly cartoon for broad Instagram audience.
Headline text: "Yuk, Rawat Ban Kendaraanmu Bersama Chitra Paratama!"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: simple cartoon vector style with ${BRAND_COLORS} color scheme. Use friendly character, bold outlines, solid colors, and approachable composition.
Additional elements: cartoon tire character, simple tools, cheerful background.
Variant note: Include a cartoon ${WEARPACK} character. ${SAFE_ZONE}`,
    "Vector Detail": `Content focus: Educational post about tire technology presented as a detailed technical vector illustration.
Headline text: "Teknologi Ban Michelin: Dirancang untuk Performa Maksimal"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: detailed vector illustration style with ${BRAND_COLORS} color scheme. Use rich linework, cross-hatching, technical detail, and premium composition.
Additional elements: detailed tire cross-section, technical callouts, brand color accents.
Variant note: Include a detailed vector ${WEARPACK} technician. ${SAFE_ZONE}`,
  },
  "Pencapaian perusahaan": {
    "Modern & Clean": `Content focus: Company achievement announcement — milestone, award, or business growth of PT Chitra Paratama.
Headline text: "PT Chitra Paratama Mencapai Milestone Baru — Terima Kasih atas Kepercayaan Anda!"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: modern, clean layout with ${BRAND_COLORS} color scheme. Use achievement iconography, bold numbers/stats, trophy or medal motif, and structured composition.
Additional elements: trophy, medal, growth chart, milestone number callout, celebratory confetti.
Variant note: Include a ${WEARPACK} team celebrating the achievement. ${SAFE_ZONE}`,
    "Elegant & Luxury": `Content focus: Prestigious company achievement or award received by PT Chitra Paratama.
Headline text: "Penghargaan Bergengsi untuk PT Chitra Paratama — Bukti Komitmen Kami"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: elegant, luxury, and prestigious layout with ${BRAND_COLORS} color scheme. Use gold accents, premium textures, award motif, and sophisticated composition.
Additional elements: gold trophy, award plaque, premium background texture, subtle sparkle.
Variant note: Include a ${WEARPACK} executive receiving the award. ${SAFE_ZONE}`,
    "Playful & Vibrant": `Content focus: Exciting company milestone or growth achievement of PT Chitra Paratama shared with enthusiasm.
Headline text: "Kami Terus Tumbuh! Terima Kasih Telah Bersama PT Chitra Paratama"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: playful, vibrant, and celebratory layout with ${BRAND_COLORS} color scheme. Use bold graphics, confetti, energetic typography, and dynamic composition.
Additional elements: confetti burst, star shapes, bold milestone number, celebratory background.
Variant note: Include a ${WEARPACK} team in a celebratory pose. ${SAFE_ZONE}`,
    "Corporate & Professional": `Content focus: Formal company achievement or business milestone announcement of PT Chitra Paratama.
Headline text: "PT Chitra Paratama: Komitmen Nyata dalam Total Tire Solution"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: corporate, professional, and authoritative layout with ${BRAND_COLORS} color scheme. Use structured layout, formal achievement iconography, clean data presentation, and business-appropriate composition.
Additional elements: achievement badge, clean chart, professional background, milestone callout.
Variant note: Include a ${WEARPACK} team in a professional group photo. ${SAFE_ZONE}`,
    Minimalist: `Content focus: Clean, focused company achievement announcement of PT Chitra Paratama.
Headline text: "Milestone Baru. Terima Kasih atas Kepercayaan Anda."
Brand/Source: "PT Chitra Paratama"
Visual style: minimalist, impactful layout with ${BRAND_COLORS} color scheme. Use a single bold number or achievement stat, abundant whitespace, and high contrast.
Additional elements: single trophy or star icon, clean solid background in brand color.
Variant note: Include a minimal achievement illustration. ${SAFE_ZONE}`,
  },
  "Event perusahaan": {
    "Modern & Clean": `Content focus: Company event announcement or recap for PT Chitra Paratama — training, seminar, gathering, or field activity.
Headline text: "PT Chitra Paratama Mengundang Anda — [Nama Event] Segera Hadir!"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: modern, clean layout with ${BRAND_COLORS} color scheme. Use event iconography, date/location callout, clean agenda layout, and structured composition.
Additional elements: microphone, stage, calendar icon, location pin, event banner.
Variant note: Include a ${WEARPACK} presenter or attendee at the event. ${SAFE_ZONE}`,
    "Elegant & Luxury": `Content focus: Exclusive company event or VIP gathering announcement for PT Chitra Paratama.
Headline text: "Undangan Eksklusif: Event Spesial PT Chitra Paratama"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: elegant, luxury, and exclusive layout with ${BRAND_COLORS} color scheme. Use premium textures, sophisticated typography, VIP atmosphere, and refined composition.
Additional elements: elegant invitation card motif, gold accent, premium venue illustration.
Variant note: Include a ${WEARPACK} executive at the event. ${SAFE_ZONE}`,
    "Playful & Vibrant": `Content focus: Fun and exciting company event or team gathering announcement for PT Chitra Paratama.
Headline text: "Yuk Ikut! Event Seru PT Chitra Paratama Sudah Menanti"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: playful, vibrant, and exciting layout with ${BRAND_COLORS} color scheme. Use bold graphics, high energy typography, inviting composition, and dynamic shapes.
Additional elements: confetti, microphone, crowd silhouette, bold event date callout.
Variant note: Include a ${WEARPACK} team in an energetic group pose. ${SAFE_ZONE}`,
    "Corporate & Professional": `Content focus: Formal company event or business seminar announcement for PT Chitra Paratama.
Headline text: "Seminar & Workshop PT Chitra Paratama — Daftarkan Diri Anda Sekarang"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: corporate, professional, and formal layout with ${BRAND_COLORS} color scheme. Use clean business graphics, structured agenda layout, authoritative tone, and professional composition.
Additional elements: podium, business audience silhouette, agenda list, date/location badge.
Variant note: Include a ${WEARPACK} speaker at the podium. ${SAFE_ZONE}`,
    Minimalist: `Content focus: Clean, focused event announcement for PT Chitra Paratama.
Headline text: "Save the Date — Event PT Chitra Paratama"
Brand/Source: "PT Chitra Paratama"
Visual style: minimalist, modern layout with ${BRAND_COLORS} color scheme. Focus purely on the event title, date, and one key visual element with a clean background.
Additional elements: single calendar icon, clean date typography, solid brand color background.
Variant note: Include a minimal event illustration. ${SAFE_ZONE}`,
  },
  "Promosi produk": {
    "Modern & Clean": `Content focus: Product or service promotion for PT Chitra Paratama — Michelin tires, tire services, or fleet solutions.
Headline text: "Solusi Ban Terbaik untuk Armada Anda — PT Chitra Paratama"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: modern, clean layout with ${BRAND_COLORS} color scheme. Use sharp product focus, clear feature hierarchy, sleek typography, and product-forward composition.
Additional elements: Michelin tire product shot, feature callout badges, clean product background.
Variant note: Include a ${WEARPACK} technician presenting the product. ${SAFE_ZONE}`,
    "Elegant & Luxury": `Content focus: Premium product promotion for PT Chitra Paratama — highlighting quality, reliability, and premium service.
Headline text: "Kualitas Premium, Performa Tak Tertandingi — Michelin x Chitra Paratama"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: elegant, luxury, and premium layout with ${BRAND_COLORS} color scheme. Use premium product photography style, gold accents, sophisticated typography, and high-end composition.
Additional elements: premium tire close-up, gold feature badges, luxury background texture.
Variant note: Include a ${WEARPACK} specialist in a premium setting. ${SAFE_ZONE}`,
    "Playful & Vibrant": `Content focus: Exciting product promotion or special offer from PT Chitra Paratama for a broad audience.
Headline text: "Promo Spesial Ban Michelin — Hanya di PT Chitra Paratama!"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: playful, vibrant, and attention-grabbing layout with ${BRAND_COLORS} color scheme. Use bold product highlight, dynamic shapes, bright promo callout, and energetic composition.
Additional elements: promo badge, bold discount callout, dynamic tire illustration, confetti.
Variant note: Include a ${WEARPACK} team member with an enthusiastic pose. ${SAFE_ZONE}`,
    "Corporate & Professional": `Content focus: B2B product promotion for PT Chitra Paratama targeting fleet managers and procurement teams.
Headline text: "Tingkatkan Efisiensi Armada Anda dengan Solusi Ban PT Chitra Paratama"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: corporate, professional, and trustworthy layout with ${BRAND_COLORS} color scheme. Use structured product presentation, ROI/benefit callouts, business iconography, and authoritative composition.
Additional elements: fleet vehicle, tire product, benefit checklist, professional background.
Variant note: Include a ${WEARPACK} account manager in a professional setting. ${SAFE_ZONE}`,
    Minimalist: `Content focus: Clean, focused product promotion for PT Chitra Paratama.
Headline text: "Ban Terbaik. Servis Terpercaya. PT Chitra Paratama."
Brand/Source: "PT Chitra Paratama"
Visual style: minimalist, product-focused layout with ${BRAND_COLORS} color scheme. Use a single product hero shot, bold headline, and clean background.
Additional elements: single tire product, minimal feature callout, solid brand color background.
Variant note: Include a minimal product illustration. ${SAFE_ZONE}`,
    "Vectorize Minimalis": `Content focus: Flat vector product promotion for PT Chitra Paratama tire services.
Headline text: "Layanan Ban Lengkap — PT Chitra Paratama"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: flat vector minimalist style with ${BRAND_COLORS} color scheme. Use simple geometric product shapes, flat service icons, and clean layout.
Additional elements: flat vector tire, service icons (wrench, checkmark, truck), brand color background.
Variant note: Include a flat vector ${WEARPACK} technician. ${SAFE_ZONE}`,
    "Vector Kartun Simple": `Content focus: Friendly cartoon product promotion for PT Chitra Paratama targeting a broad social media audience.
Headline text: "Butuh Ban Baru? Chitra Paratama Siap Bantu!"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: simple cartoon vector style with ${BRAND_COLORS} color scheme. Use friendly characters, bold outlines, solid colors, and approachable composition.
Additional elements: cartoon tire character, friendly ${WEARPACK} cartoon, cheerful background.
Variant note: Include a cartoon ${WEARPACK} character holding a tire. ${SAFE_ZONE}`,
    "Vector Detail": `Content focus: Detailed vector product showcase for PT Chitra Paratama premium tire range.
Headline text: "Presisi Tinggi, Kualitas Terjamin — Ban Michelin dari Chitra Paratama"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: detailed vector illustration style with ${BRAND_COLORS} color scheme. Use rich linework, technical tire detail, cross-section callouts, and premium composition.
Additional elements: detailed tire cross-section, technical feature callouts, brand color accents.
Variant note: Include a detailed vector ${WEARPACK} technician inspecting the tire. ${SAFE_ZONE}`,
  },
  "Hari Nasional": {
    "Modern & Clean": `Content focus: National day greeting from PT Chitra Paratama — Independence Day, National Work Safety Day, or other Indonesian national holidays.
Headline text: "Selamat Hari Nasional dari PT Chitra Paratama — Bersama Membangun Indonesia"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: modern, clean layout with ${BRAND_COLORS} color scheme combined with national day motifs (red-white for Independence Day, etc.). Use patriotic iconography, clean composition, and structured layout.
Additional elements: Indonesian flag motif, national day symbol, patriotic color accents.
Variant note: Include a ${WEARPACK} team in a patriotic group pose. ${SAFE_ZONE}`,
    "Elegant & Luxury": `Content focus: Elegant national day greeting from PT Chitra Paratama with a premium, respectful tone.
Headline text: "Dengan Bangga, PT Chitra Paratama Mengucapkan Selamat Hari Nasional"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: elegant, sophisticated layout with ${BRAND_COLORS} color scheme and subtle national day motifs. Use premium textures, refined typography, and balanced composition.
Additional elements: elegant national symbol, gold accent, premium background texture.
Variant note: Include a ${WEARPACK} executive in a respectful pose. ${SAFE_ZONE}`,
    "Playful & Vibrant": `Content focus: Energetic national day celebration post from PT Chitra Paratama for broad Instagram audience.
Headline text: "Semangat Hari Nasional! PT Chitra Paratama Bangga Jadi Bagian Indonesia"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: playful, vibrant, and celebratory layout with ${BRAND_COLORS} color scheme and national day energy. Use bold graphics, confetti, patriotic colors, and dynamic composition.
Additional elements: confetti in national colors, bold national day callout, energetic background.
Variant note: Include a ${WEARPACK} team in a celebratory patriotic pose. ${SAFE_ZONE}`,
    "Corporate & Professional": `Content focus: Formal national day greeting from PT Chitra Paratama with a corporate, respectful tone.
Headline text: "PT Chitra Paratama Mengucapkan Selamat Hari Nasional Indonesia"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: corporate, professional, and formal layout with ${BRAND_COLORS} color scheme and national day motifs. Use structured layout, formal patriotic iconography, and authoritative composition.
Additional elements: Indonesian national symbol, formal flag motif, professional background.
Variant note: Include a ${WEARPACK} team in a formal group photo. ${SAFE_ZONE}`,
    Minimalist: `Content focus: Clean, focused national day greeting from PT Chitra Paratama.
Headline text: "Selamat Hari Nasional. Dari Kami, untuk Indonesia."
Brand/Source: "PT Chitra Paratama"
Visual style: minimalist, impactful layout with ${BRAND_COLORS} color scheme and a single national day motif. Use abundant whitespace, bold headline, and high contrast.
Additional elements: single national symbol or flag icon, clean solid background.
Variant note: Include a minimal national day illustration. ${SAFE_ZONE}`,
  },
}
function getPromptTemplate(contentType: (typeof contentTypes)[number], visualStyle: VisualStyle) {
  if (visualStyle === "Style Retro") return promptTemplates[contentType][visualStyle] || getRetroPromptTemplate(contentType)
  if (visualStyle === "Vector Detail") return promptTemplates[contentType][visualStyle] || getVectorDetailPromptTemplate(contentType)
  return promptTemplates[contentType][visualStyle] || getVectorCartoonPromptTemplate(contentType)
}

function getRetroPromptTemplate(contentType: (typeof contentTypes)[number]) {
  const focusByContentType: Record<(typeof contentTypes)[number], string> = {
    "Ucapan ulang tahun customer": "Birthday greeting for a valued customer or partner of PT Chitra Paratama — warm, nostalgic, and memorable.",
    Edukasi: "Educational post about tire safety, maintenance tips, or fleet management knowledge presented as a vintage editorial travel poster.",
    "Pencapaian perusahaan": "Company achievement or milestone celebration for PT Chitra Paratama — bold, heroic, and commemorative.",
    "Event perusahaan": "Company event announcement or recap for PT Chitra Paratama — energetic, destination-like, and poster-worthy.",
    "Promosi produk": "Product or service promotion for PT Chitra Paratama Michelin tire solutions — heroic and cinematic.",
    "Hari Nasional": "National holiday greeting from PT Chitra Paratama — patriotic, vintage, and editorial.",
  }
  const headlineByContentType: Record<(typeof contentTypes)[number], string> = {
    "Ucapan ulang tahun customer": "Selamat Ulang Tahun — Salam Hangat dari Chitra Paratama",
    Edukasi: "Tips Ban Hari Ini — Perjalanan Aman Dimulai dari Ban",
    "Pencapaian perusahaan": "Milestone Baru PT Chitra Paratama",
    "Event perusahaan": "Event PT Chitra Paratama — Siap Berangkat Bersama",
    "Promosi produk": "Solusi Ban Andal untuk Setiap Perjalanan",
    "Hari Nasional": "Selamat Hari Nasional dari PT Chitra Paratama",
  }

  return `Content focus: ${focusByContentType[contentType]}
Headline text: "${headlineByContentType[contentType]}"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: ${RETRO_STYLE_PROMPT}
Additional elements: vintage tire-service scene, stylized road or fleet environment, subtle sunburst or map-like background, painterly gouache details, visible grain texture.
Variant note: Create a full-bleed retro poster with a heroic composition, fisheye perspective or tiny planet feel when suitable, dynamic low angle, clear central focal point, readable headline, and safe placement away from top-left logo and bottom footer overlays. ${SAFE_ZONE}`
}

function getVectorCartoonPromptTemplate(contentType: (typeof contentTypes)[number]) {
  const focusByContentType: Record<(typeof contentTypes)[number], string> = {
    "Ucapan ulang tahun customer": "Birthday greeting for a valued customer or partner of PT Chitra Paratama — warm, friendly, and celebratory.",
    Edukasi: "Educational post about tire safety, maintenance tips, or fleet management knowledge for Indonesian businesses.",
    "Pencapaian perusahaan": "Company achievement or milestone celebration for PT Chitra Paratama — proud and energetic.",
    "Event perusahaan": "Company event announcement or recap for PT Chitra Paratama — fun and inviting.",
    "Promosi produk": "Product or service promotion for PT Chitra Paratama Michelin tire solutions — friendly and approachable.",
    "Hari Nasional": "National holiday greeting from PT Chitra Paratama — patriotic and celebratory.",
  }
  const headlineByContentType: Record<(typeof contentTypes)[number], string> = {
    "Ucapan ulang tahun customer": "Selamat Ulang Tahun! Semoga Sukses Selalu",
    Edukasi: "Tips Ban Hari Ini dari Chitra Paratama",
    "Pencapaian perusahaan": "Kami Terus Tumbuh — Terima Kasih!",
    "Event perusahaan": "Yuk Ikut! Event Seru PT Chitra Paratama",
    "Promosi produk": "Butuh Ban Terbaik? Chitra Paratama Siap Bantu!",
    "Hari Nasional": "Selamat Hari Nasional dari PT Chitra Paratama",
  }

  return `Content focus: ${focusByContentType[contentType]}
Headline text: "${headlineByContentType[contentType]}"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: Vector Kartun Simple — flat vector cartoon, clean and friendly, bold outlines, solid brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56), simplified character shapes, approachable composition. Avoid photorealistic, 3D render, complex textures, or excessive detail.
Additional elements: relevant cartoon tire, tools, or celebratory elements in brand colors.
Variant note: One clear focal scene, readable headline, balanced whitespace, friendly flat-vector character wearing wearpack safety TWO-TONE resmi: lengan BIRU NAVY GELAP (#002D56), panel dada/bahu atas HIJAU NEON (#8DC63F) berada DI ATAS strip reflektif atas, dua strip reflektif silver horizontal mengelilingi badan dengan strip utama tepat di atas pusar/udel, dan area perut sampai bawah DI BAWAH strip bawah berwarna BIRU NAVY GELAP (#002D56). WAJIB: di atas saku dada kiri wearpack, tempel patch logo Chitra Paratama berbentuk persegi panjang kecil dengan BACKGROUND PUTIH SOLID di belakang logo — logo CP berwarna asli di atas kotak putih, dijahit/bordir natural ke kain wearpack, terlihat jelas dan kontras. Patch ini harus tampak seperti name tag atau label bordir resmi yang menempel di atas saku, bukan stiker mengambang. Gunakan warna brand: Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56. Komposisi profesional, pencahayaan natural. Do not place text or key elements in the top-left 300x300px area or bottom 150px of the canvas.`
}

function getVectorDetailPromptTemplate(contentType: (typeof contentTypes)[number]) {
  const focusByContentType: Record<(typeof contentTypes)[number], string> = {
    "Ucapan ulang tahun customer": "Birthday greeting for a valued customer or partner of PT Chitra Paratama — premium and detailed.",
    Edukasi: "Educational post about tire technology or fleet management presented as a detailed technical illustration.",
    "Pencapaian perusahaan": "Company achievement or milestone celebration for PT Chitra Paratama — bold and prestigious.",
    "Event perusahaan": "Company event announcement or recap for PT Chitra Paratama — dynamic and detailed.",
    "Promosi produk": "Premium product showcase for PT Chitra Paratama Michelin tire range — technical and impressive.",
    "Hari Nasional": "National holiday greeting from PT Chitra Paratama — patriotic and richly illustrated.",
  }
  const headlineByContentType: Record<(typeof contentTypes)[number], string> = {
    "Ucapan ulang tahun customer": "Selamat Ulang Tahun — Dari PT Chitra Paratama",
    Edukasi: "Teknologi Ban Michelin: Presisi untuk Performa Terbaik",
    "Pencapaian perusahaan": "Milestone Baru PT Chitra Paratama — Komitmen Nyata",
    "Event perusahaan": "Event PT Chitra Paratama — Hadir dan Rasakan Perbedaannya",
    "Promosi produk": "Presisi Tinggi, Kualitas Terjamin — Michelin x Chitra Paratama",
    "Hari Nasional": "Dengan Bangga, PT Chitra Paratama Merayakan Hari Nasional",
  }

  return `Content focus: ${focusByContentType[contentType]}
Headline text: "${headlineByContentType[contentType]}"
Brand/Source: "PT Chitra Paratama — Total Tire Solution"
Visual style: Vector Detail — Inked Comic Cartoon. Bold ink outlines, detailed cross-hatching and line-work shading, expressive comic-book style characters, dynamic composition with depth and energy, cel-shaded color fills using Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56). Characters wear detailed wearpack safety TWO-TONE resmi: lengan BIRU NAVY GELAP (#002D56), panel dada/bahu atas HIJAU NEON (#8DC63F) berada DI ATAS strip reflektif atas, dua strip reflektif silver horizontal mengelilingi badan dengan strip utama tepat di atas pusar/udel, dan area perut sampai bawah DI BAWAH strip bawah berwarna BIRU NAVY GELAP (#002D56). WAJIB: di atas saku dada kiri wearpack, tempel patch logo Chitra Paratama berbentuk persegi panjang kecil dengan BACKGROUND PUTIH SOLID di belakang logo — logo CP berwarna asli di atas kotak putih, dijahit/bordir natural ke kain wearpack, terlihat jelas dan kontras. Patch ini harus tampak seperti name tag atau label bordir resmi yang menempel di atas saku, bukan stiker mengambang. Gunakan warna brand: Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56. Komposisi profesional, pencahayaan natural. rendered in comic-book style with visible stitch lines. Avoid photorealistic, 3D render, flat minimalism.
Additional elements: detailed tire cross-section, technical callouts, or relevant industry elements in brand colors.
Variant note: Bold inked comic composition — one clear focal scene with rich vector linework, expressive characters, readable headline in comic-style lettering, and dynamic depth. Do not place text or key elements in the top-left 300x300px area or bottom 150px of the canvas.`
}

export function InstagramImageGeneratorClient() {
  const [activeTab, setActiveTab] = React.useState("generator")
  const [contentType, setContentType] = React.useState<(typeof contentTypes)[number]>("Edukasi")
  const [visualStyle, setVisualStyle] = React.useState<VisualStyle>(defaultVisualStyleByContentType.Edukasi)
  const [prompt, setPrompt] = React.useState(getPromptTemplate("Edukasi", defaultVisualStyleByContentType.Edukasi))
  const [format, setFormat] = React.useState<ImageFormat>("portrait")
  const [generatorOverlayVariant, setGeneratorOverlayVariant] = React.useState<OverlayVariant>("standard")
  const [overlayFormat, setOverlayFormat] = React.useState<OverlayFormat>("feed")
  const [overlayFileName, setOverlayFileName] = React.useState("")
  const [uploadedAssets, setUploadedAssets] = React.useState<UploadedAsset[]>([])

  // --- Ucapan Ulang Tahun Customer ---
  const [birthdayHeadline, setBirthdayHeadline] = React.useState("")
  const [birthdayCustomerName, setBirthdayCustomerName] = React.useState("")
  const [birthdayAge, setBirthdayAge] = React.useState("")
  const [birthdayLogoAssets, setBirthdayLogoAssets] = React.useState<UploadedAsset[]>([])
  const [birthdayCustomGreeting, setBirthdayCustomGreeting] = React.useState("")

  // --- Edukasi ---
  const [eduHeadline, setEduHeadline] = React.useState("")
  const [eduTopic, setEduTopic] = React.useState("")
  const [eduKeyPoints, setEduKeyPoints] = React.useState("")
  const [eduPhotoAssets, setEduPhotoAssets] = React.useState<UploadedAsset[]>([])

  // --- Pencapaian Perusahaan ---
  const [achievementHeadline, setAchievementHeadline] = React.useState("")
  const [achievementName, setAchievementName] = React.useState("")
  const [achievementStat, setAchievementStat] = React.useState("")
  const [achievementDesc, setAchievementDesc] = React.useState("")
  const [achievementPhotoAssets, setAchievementPhotoAssets] = React.useState<UploadedAsset[]>([])

  // --- Event Perusahaan ---
  const [eventHeadline, setEventHeadline] = React.useState("")
  const [eventName, setEventName] = React.useState("")
  const [eventLocationDate, setEventLocationDate] = React.useState("")
  const [eventDesc, setEventDesc] = React.useState("")
  const [eventPhotoAssets, setEventPhotoAssets] = React.useState<UploadedAsset[]>([])

  // --- Promosi Produk ---
  const [promoHeadline, setPromoHeadline] = React.useState("")
  const [promoProductName, setPromoProductName] = React.useState("")
  const [promoHighlights, setPromoHighlights] = React.useState("")
  const [promoCta, setPromoCta] = React.useState("")
  const [promoPhotoAssets, setPromoPhotoAssets] = React.useState<UploadedAsset[]>([])

  // --- Hari Nasional ---
  const [holidayHeadline, setHolidayHeadline] = React.useState("")
  const [nearestHoliday, setNearestHoliday] = React.useState<Holiday | null>(null)
  const [isLoadingHoliday, setIsLoadingHoliday] = React.useState(false)
  const [holidayCustomMessage, setHolidayCustomMessage] = React.useState("")

  // --- Person / Wearpack toggle (per category) ---
  const [showPerson, setShowPerson] = React.useState(false)
  const [personActivity, setPersonActivity] = React.useState("")

  const [result, setResult] = React.useState<GeneratedImageResult | null>(null)
  const [variationResults, setVariationResults] = React.useState<GeneratedImageResult[]>([])
  const [overlayResults, setOverlayResults] = React.useState<OverlayImageResult[]>([])
  const [logoFixerSource, setLogoFixerSource] = React.useState<LogoFixerSource | null>(null)
  const [logoFixerCustomLogo, setLogoFixerCustomLogo] = React.useState<string | null>(null)
  const [logoFixerCustomLogoName, setLogoFixerCustomLogoName] = React.useState("")
  const [logoFixerResult, setLogoFixerResult] = React.useState<LogoFixerResult | null>(null)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isComposingOverlay, setIsComposingOverlay] = React.useState(false)
  const [isFixingLogo, setIsFixingLogo] = React.useState(false)
  const [isEnhancing, setIsEnhancing] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch nearest holiday when Hari Nasional is selected
  React.useEffect(() => {
    if (contentType !== "Hari Nasional") return
    let mounted = true
    const controller = new AbortController()
    queueMicrotask(() => { if (mounted) setIsLoadingHoliday(true) })
    fetch("/api/national-holidays", { signal: controller.signal })
      .then((res) => res.json())
      .then((data: { nearestHoliday?: Holiday; error?: string }) => {
        if (!mounted) return
        if (!data.nearestHoliday) throw new Error(data.error || "Data Hari Nasional tidak tersedia")
        setNearestHoliday(data.nearestHoliday)
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        const message = err instanceof Error ? err.message : "Gagal mengambil Hari Nasional terdekat"
        setError(message)
        toast.error(message)
      })
      .finally(() => { if (mounted) setIsLoadingHoliday(false) })
    return () => { mounted = false; controller.abort() }
  }, [contentType])

  React.useEffect(() => {
    setOverlayResults([])
  }, [overlayFormat])

  // Wearpack instruction injected when showPerson is true
  const WEARPACK_INSTRUCTION = "Tampilkan pekerja/karyawan memakai wearpack safety TWO-TONE resmi: lengan BIRU NAVY GELAP (#002D56), panel dada/bahu atas HIJAU NEON (#8DC63F) berada DI ATAS strip reflektif atas, dua strip reflektif silver horizontal mengelilingi badan dengan strip utama tepat di atas pusar/udel, dan area perut sampai bawah DI BAWAH strip bawah berwarna BIRU NAVY GELAP (#002D56). WAJIB: di atas saku dada kiri wearpack, tempel patch logo Chitra Paratama berbentuk persegi panjang kecil dengan BACKGROUND PUTIH SOLID di belakang logo — logo CP berwarna asli di atas kotak putih, dijahit/bordir natural ke kain wearpack, terlihat jelas dan kontras. Patch ini harus tampak seperti name tag atau label bordir resmi yang menempel di atas saku, bukan stiker mengambang. Gunakan warna brand: Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56. Komposisi profesional, pencahayaan natural."

  // Sync prompt whenever any field changes
  React.useEffect(() => {
    const base = getPromptTemplate(contentType, visualStyle)

    // Strip any existing wearpack/orang instruction from base template
    const noPersonBase = base
      // Strip ALL Variant note lines (they contain person/wearpack instructions)
      .replace(/\n?Variant note:[^\n]*/gi, "")
      // Strip any line containing wearpack/seragam/uniform/person instructions
      .replace(/\n?[^\n]*(wearpack|seragam kerja|work uniform|WAJIB.*orang|Include a person|wearing official)[^\n]*/gi, "")
      // Strip headline so field controls it
      .replace(/\nHeadline text: "[^"]*"/g, "")
      .replace(/^Headline text: "[^"]*"\n?/m, "")

    // Check if reference photos uploaded — preserve people in those photos
    const categoryPhotos = contentType === "Edukasi" ? eduPhotoAssets
      : contentType === "Pencapaian perusahaan" ? achievementPhotoAssets
      : contentType === "Event perusahaan" ? eventPhotoAssets
      : contentType === "Promosi produk" ? promoPhotoAssets
      : []
    const hasReferencePhotos = categoryPhotos.length > 0 || uploadedAssets.length > 0

    const personLine = showPerson
      ? `\n${WEARPACK_INSTRUCTION}${personActivity.trim() ? ` Kegiatan yang dilakukan: ${personActivity.trim()}.` : ""}`
      : hasReferencePhotos
        ? "\nJika ada orang dalam foto referensi yang diupload, pertahankan keberadaan mereka namun pastikan memakai wearpack safety TWO-TONE resmi: lengan BIRU NAVY GELAP (#002D56), panel dada/bahu atas HIJAU NEON (#8DC63F) berada DI ATAS strip reflektif atas, dua strip reflektif silver horizontal mengelilingi badan dengan strip utama tepat di atas pusar/udel, dan area perut sampai bawah DI BAWAH strip bawah berwarna BIRU NAVY GELAP (#002D56). WAJIB: di atas saku dada kiri wearpack, tempel patch logo Chitra Paratama berbentuk persegi panjang kecil dengan BACKGROUND PUTIH SOLID di belakang logo — logo CP berwarna asli di atas kotak putih, dijahit/bordir natural ke kain wearpack, terlihat jelas dan kontras. Patch ini harus tampak seperti name tag atau label bordir resmi yang menempel di atas saku, bukan stiker mengambang. Gunakan warna brand: Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56. Komposisi profesional, pencahayaan natural. Jika tidak ada orang dalam foto referensi, jangan tambahkan orang — fokus pada objek dan produk."
        : "\nJangan tampilkan orang atau manusia dalam gambar — fokus pada objek, produk, atau elemen grafis saja."

    if (contentType === "Ucapan ulang tahun customer") {
      const namePart = birthdayCustomerName.trim() ? `untuk ${birthdayCustomerName.trim()}` : "untuk [Nama Customer/Perusahaan]"
      const agePart = birthdayAge.trim() ? ` (ulang tahun ke-${birthdayAge.trim()})` : ""
      const greetingPart = birthdayCustomGreeting.trim() ? `\nCustom Ucapan: ${birthdayCustomGreeting.trim()}.` : ""
      const logoPart = birthdayLogoAssets.length > 0 ? `\nLogo Customer: gunakan ${birthdayLogoAssets.map((a) => a.filename).join(", ")} sebagai logo perusahaan customer dalam desain, tampilkan secara natural dan proporsional.` : ""
      const bdBase = noPersonBase.replace(/untuk \[Nama Customer\/Perusahaan\]|untuk \[NAMA CUSTOMER\/PERUSAHAAN\]/gi, namePart + agePart)
      const bdFinal = birthdayHeadline.trim() ? bdBase.replace(/Content focus:/, `Headline text: "${birthdayHeadline.trim()}"\nContent focus:`) : bdBase
      setPrompt(bdFinal + greetingPart + logoPart + personLine)
      return
    }

    if (contentType === "Edukasi") {
      const topicPart = eduTopic.trim() ? `\nTopik: ${eduTopic.trim()}.` : ""
      const keyPart = eduKeyPoints.trim() ? `\nPoin Utama: ${eduKeyPoints.trim()}.` : ""
      const photoPart = eduPhotoAssets.length > 0 ? `\nReferensi Visual: gunakan ${eduPhotoAssets.map((a) => a.filename).join(", ")} sebagai referensi visual.` : ""
      const eduFinal = eduHeadline.trim() ? noPersonBase.replace(/Content focus:/, `Headline text: "${eduHeadline.trim()}"\nContent focus:`) : noPersonBase
      setPrompt(eduFinal + topicPart + keyPart + photoPart + personLine)
      return
    }

    if (contentType === "Pencapaian perusahaan") {
      const namePart = achievementName.trim() ? `\nNama Pencapaian: ${achievementName.trim()}.` : ""
      const statPart = achievementStat.trim() ? `\nAngka/Statistik: ${achievementStat.trim()}.` : ""
      const descPart = achievementDesc.trim() ? `\nDeskripsi: ${achievementDesc.trim()}.` : ""
      const photoPart = achievementPhotoAssets.length > 0 ? `\nFoto Pencapaian: gunakan ${achievementPhotoAssets.map((a) => a.filename).join(", ")} sebagai referensi visual.` : ""
      const achFinal = achievementHeadline.trim() ? noPersonBase.replace(/Content focus:/, `Headline text: "${achievementHeadline.trim()}"\nContent focus:`) : noPersonBase
      setPrompt(achFinal + namePart + statPart + descPart + photoPart + personLine)
      return
    }

    if (contentType === "Event perusahaan") {
      const namePart = eventName.trim() ? `\nNama Event: ${eventName.trim()}.` : ""
      const locPart = eventLocationDate.trim() ? `\nLokasi & Tanggal: ${eventLocationDate.trim()}.` : ""
      const descPart = eventDesc.trim() ? `\nDeskripsi: ${eventDesc.trim()}.` : ""
      const photoPart = eventPhotoAssets.length > 0 ? `\nFoto Kegiatan: gunakan ${eventPhotoAssets.map((a) => a.filename).join(", ")} sebagai referensi visual.` : ""
      const evFinal = eventHeadline.trim() ? noPersonBase.replace(/Content focus:/, `Headline text: "${eventHeadline.trim()}"\nContent focus:`) : noPersonBase
      setPrompt(evFinal + namePart + locPart + descPart + photoPart + personLine)
      return
    }

    if (contentType === "Promosi produk") {
      const prodPart = promoProductName.trim() ? `\nProduk/Layanan: ${promoProductName.trim()}.` : ""
      const hlPart = promoHighlights.trim() ? `\nKeunggulan: ${promoHighlights.trim()}.` : ""
      const ctaPart = promoCta.trim() ? `\nCall to Action: ${promoCta.trim()}.` : ""
      const photoPart = promoPhotoAssets.length > 0 ? `\nFoto Produk: gunakan ${promoPhotoAssets.map((a) => a.filename).join(", ")} sebagai referensi visual produk.` : ""
      const proFinal = promoHeadline.trim() ? noPersonBase.replace(/Content focus:/, `Headline text: "${promoHeadline.trim()}"\nContent focus:`) : noPersonBase
      setPrompt(proFinal + prodPart + hlPart + ctaPart + photoPart + personLine)
      return
    }

    if (contentType === "Hari Nasional") {
      if (!nearestHoliday) return
      const msgPart = holidayCustomMessage.trim() ? `\nPesan Khusus: ${holidayCustomMessage.trim()}.` : ""
      const hnBase2 = noPersonBase
        .replace(/\[NAMA HARI NASIONAL\]/g, nearestHoliday.name)
        .replace(/\[ELEMEN TAMBAHAN SESUAI HARI RAYA\]/g, `elemen relevan untuk ${nearestHoliday.name}`)
      const hnFinal = holidayHeadline.trim() ? hnBase2.replace(/Content focus:/, `Headline text: "${holidayHeadline.trim()}"\nContent focus:`) : hnBase2
      setPrompt(hnFinal + msgPart + personLine)
      return
    }

    setPrompt(noPersonBase + personLine)
  }, [
    contentType, visualStyle,
    showPerson, personActivity,
    birthdayHeadline, eduHeadline, achievementHeadline, eventHeadline, promoHeadline, holidayHeadline,
    birthdayCustomerName, birthdayAge, birthdayCustomGreeting, birthdayLogoAssets,
    eduTopic, eduKeyPoints, eduPhotoAssets,
    achievementName, achievementStat, achievementDesc, achievementPhotoAssets,
    eventName, eventLocationDate, eventDesc, eventPhotoAssets,
    promoProductName, promoHighlights, promoCta, promoPhotoAssets,
    nearestHoliday, holidayCustomMessage,
  ])
  const getCategoryReferenceAssets = React.useCallback(() => {
    if (contentType === "Ucapan ulang tahun customer") return birthdayLogoAssets
    if (contentType === "Edukasi") return eduPhotoAssets
    if (contentType === "Pencapaian perusahaan") return achievementPhotoAssets
    if (contentType === "Event perusahaan") return eventPhotoAssets
    if (contentType === "Promosi produk") return promoPhotoAssets
    return []
  }, [contentType, birthdayLogoAssets, eduPhotoAssets, achievementPhotoAssets, eventPhotoAssets, promoPhotoAssets])

  const buildRequestPrompt = React.useCallback((basePrompt: string) => {
    const details: string[] = []

    if (contentType === "Ucapan ulang tahun customer") {
      details.push("Detail Ucapan Ulang Tahun Customer:")
      if (birthdayHeadline.trim()) details.push(`Headline: ${birthdayHeadline.trim()}.`)
      if (birthdayCustomerName.trim()) details.push(`Nama Customer: ${birthdayCustomerName.trim()}.`)
      if (birthdayAge.trim()) details.push(`Ulang tahun ke: ${birthdayAge.trim()}.`)
      if (birthdayCustomGreeting.trim()) details.push(`Custom Ucapan: ${birthdayCustomGreeting.trim()}.`)
      if (birthdayLogoAssets.length > 0) details.push(`Logo Customer: gunakan ${birthdayLogoAssets.map((a) => a.filename).join(", ")} sebagai logo perusahaan customer, tampilkan natural dan proporsional dalam desain.`)
    }
    if (contentType === "Edukasi") {
      details.push("Detail Konten Edukasi:")
      if (eduHeadline.trim()) details.push(`Headline: ${eduHeadline.trim()}.`)
      if (eduTopic.trim()) details.push(`Topik: ${eduTopic.trim()}.`)
      if (eduKeyPoints.trim()) details.push(`Poin Utama: ${eduKeyPoints.trim()}.`)
      if (eduPhotoAssets.length > 0) details.push(`Referensi Visual: gunakan ${eduPhotoAssets.map((a) => a.filename).join(", ")} sebagai referensi visual.`)
    }
    if (contentType === "Pencapaian perusahaan") {
      details.push("Detail Pencapaian Perusahaan:")
      if (achievementHeadline.trim()) details.push(`Headline: ${achievementHeadline.trim()}.`)
      if (achievementName.trim()) details.push(`Nama Pencapaian: ${achievementName.trim()}.`)
      if (achievementStat.trim()) details.push(`Angka/Statistik: ${achievementStat.trim()}.`)
      if (achievementDesc.trim()) details.push(`Deskripsi: ${achievementDesc.trim()}.`)
      if (achievementPhotoAssets.length > 0) details.push(`Foto Pencapaian: gunakan ${achievementPhotoAssets.map((a) => a.filename).join(", ")} sebagai referensi visual.`)
    }
    if (contentType === "Event perusahaan") {
      details.push("Detail Event Perusahaan:")
      if (eventHeadline.trim()) details.push(`Headline: ${eventHeadline.trim()}.`)
      if (eventName.trim()) details.push(`Nama Event: ${eventName.trim()}.`)
      if (eventLocationDate.trim()) details.push(`Lokasi & Tanggal: ${eventLocationDate.trim()}.`)
      if (eventDesc.trim()) details.push(`Deskripsi: ${eventDesc.trim()}.`)
      if (eventPhotoAssets.length > 0) details.push(`Foto Kegiatan: gunakan ${eventPhotoAssets.map((a) => a.filename).join(", ")} sebagai referensi visual.`)
    }
    if (contentType === "Promosi produk") {
      details.push("Detail Promosi Produk:")
      if (promoHeadline.trim()) details.push(`Headline: ${promoHeadline.trim()}.`)
      if (promoProductName.trim()) details.push(`Produk/Layanan: ${promoProductName.trim()}.`)
      if (promoHighlights.trim()) details.push(`Keunggulan: ${promoHighlights.trim()}.`)
      if (promoCta.trim()) details.push(`Call to Action: ${promoCta.trim()}.`)
      if (promoPhotoAssets.length > 0) details.push(`Foto Produk: gunakan ${promoPhotoAssets.map((a) => a.filename).join(", ")} sebagai referensi visual produk.`)
    }
    if (contentType === "Hari Nasional") {
      details.push("Detail Hari Nasional:")
      if (holidayHeadline.trim()) details.push(`Headline: ${holidayHeadline.trim()}.`)
      if (nearestHoliday) details.push(`Hari Nasional: ${nearestHoliday.name} (${nearestHoliday.date}).`)
      if (holidayCustomMessage.trim()) details.push(`Pesan Khusus: ${holidayCustomMessage.trim()}.`)
    }

    if (showPerson) {
      details.push("Tampilkan Orang/Pekerja: YA — wajib memakai wearpack safety TWO-TONE resmi: lengan BIRU NAVY GELAP (#002D56), panel dada/bahu atas HIJAU NEON (#8DC63F) berada DI ATAS strip reflektif atas, dua strip reflektif silver horizontal mengelilingi badan dengan strip utama tepat di atas pusar/udel, dan area perut sampai bawah DI BAWAH strip bawah berwarna BIRU NAVY GELAP (#002D56). WAJIB: di atas saku dada kiri wearpack, tempel patch logo Chitra Paratama berbentuk persegi panjang kecil dengan BACKGROUND PUTIH SOLID di belakang logo — logo CP berwarna asli di atas kotak putih, dijahit/bordir natural ke kain wearpack, terlihat jelas dan kontras. Patch ini harus tampak seperti name tag atau label bordir resmi yang menempel di atas saku, bukan stiker mengambang. Gunakan warna brand: Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56. Komposisi profesional, pencahayaan natural.")
      if (personActivity.trim()) details.push(`Kegiatan yang dilakukan: ${personActivity.trim()}.`)
    } else {
      details.push("Tampilkan Orang/Pekerja: TIDAK — jangan tampilkan orang atau manusia, fokus pada objek, produk, atau elemen grafis saja.")
    }

    if (details.length === 0) return basePrompt
    return `${basePrompt.trim()}\n\n${details.join("\n")}`
  }, [
    contentType,
    showPerson, personActivity,
    birthdayHeadline, eduHeadline, achievementHeadline, eventHeadline, promoHeadline, holidayHeadline,
    birthdayCustomerName, birthdayAge, birthdayCustomGreeting, birthdayLogoAssets,
    eduTopic, eduKeyPoints, eduPhotoAssets,
    achievementName, achievementStat, achievementDesc, achievementPhotoAssets,
    eventName, eventLocationDate, eventDesc, eventPhotoAssets,
    promoProductName, promoHighlights, promoCta, promoPhotoAssets,
    nearestHoliday, holidayCustomMessage,
  ])
  const generateImage = async () => {
    const trimmedPrompt = buildRequestPrompt(prompt).trim()
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
          overlayVariant: generatorOverlayVariant,
          contentType,
          visualStyle,
          referenceAssets: [...getCategoryReferenceAssets(), ...uploadedAssets],
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
    const trimmedPrompt = buildRequestPrompt(prompt).trim()
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
          overlayVariant: generatorOverlayVariant,
          contentType,
          visualStyle,
          referenceAssets: [...getCategoryReferenceAssets(), ...uploadedAssets],
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
    const trimmedPrompt = buildRequestPrompt(prompt).trim()
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
          overlayVariant: generatorOverlayVariant,
          contentType,
          visualStyle,
          referenceAssets: [...getCategoryReferenceAssets(), ...uploadedAssets],
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

  const uploadSelectedFiles = async (
    selectedFiles: File[],
    availableSlots: number,
    onUploaded: (assets: UploadedAsset[]) => void,
    emptyErrorMessage = "Semua file gagal diunggah. Periksa format dan ukuran file.",
  ) => {
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
    }).slice(0, Math.max(0, availableSlots))

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
        onUploaded(uploaded)
        toast.success(`${uploaded.length} gambar berhasil diunggah`)
      } else {
        setError(emptyErrorMessage)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload gambar gagal"
      setError(message)
      toast.error(message)
    } finally {
      setIsUploading(false)
    }
  }

  const onFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    event.target.value = ""
    await uploadSelectedFiles(
      selectedFiles,
      8 - uploadedAssets.length,
      (assets) => setUploadedAssets((current) => [...current, ...assets].slice(0, 8)),
    )
  }

  const onCategoryFilesChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    currentAssets: UploadedAsset[],
    setAssets: React.Dispatch<React.SetStateAction<UploadedAsset[]>>,
    maxFiles: number,
  ) => {
    const selectedFiles = Array.from(event.target.files || [])
    event.target.value = ""
    await uploadSelectedFiles(
      selectedFiles,
      maxFiles - currentAssets.length,
      (assets) => setAssets((current) => [...current, ...assets].slice(0, maxFiles)),
      "File kategori gagal diunggah. Periksa format dan ukuran file.",
    )
  }

  const onOverlayFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      const message = "Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP"
      setError(message)
      toast.error(message)
      return
    }

    setIsComposingOverlay(true)
    setError(null)
    setOverlayResults([])
    setOverlayFileName(file.name)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)

    try {
      const variants: OverlayVariant[] = ["standard", "white"]
      const results = await Promise.all(variants.map(async (variant) => {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("format", overlayFormat)
        formData.append("overlayVariant", variant)

        const response = await fetch("/api/instagram-overlay-generator", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        })
        const data = await response.json().catch(() => null) as OverlayImageResult & { success?: boolean; error?: string } | null
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || `Gagal membuat bingkai overlay ${overlayVariantLabels[variant]}`)
        }

        return {
          image: data.image,
          mimeType: data.mimeType,
          width: data.width,
          height: data.height,
          format: data.format,
          overlayVariant: data.overlayVariant,
          template: data.template,
        }
      }))

      setOverlayResults(results)
      toast.success("Preview overlay Standar dan Putih berhasil dibuat")
    } catch (err) {
      const message = err instanceof Error ? (err.name === "AbortError" ? "Waktu proses overlay habis" : err.message) : "Gagal membuat bingkai overlay"
      setError(message)
      toast.error(message)
    } finally {
      clearTimeout(timeout)
      setIsComposingOverlay(false)
    }
  }

  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("Gagal membaca file gambar"))
    reader.readAsDataURL(file)
  })

  const onLogoFixerSourceChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    try {
      const image = await fileToDataUrl(file)
      setLogoFixerSource({ image, name: file.name })
      setLogoFixerResult(null)
      toast.success("Gambar sumber siap diperbaiki")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal membaca gambar sumber"
      setError(message)
      toast.error(message)
    }
  }

  const onLogoFixerCustomLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    try {
      const image = await fileToDataUrl(file)
      setLogoFixerCustomLogo(image)
      setLogoFixerCustomLogoName(file.name)
      toast.success("Logo custom siap dipakai")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal membaca logo custom"
      setError(message)
      toast.error(message)
    }
  }

  const sendToLogoFixer = (source: GeneratedImageResult, name = "hasil-ai-generator.png") => {
    setLogoFixerSource({ image: source.image, name, width: source.width, height: source.height })
    setLogoFixerResult(null)
    setActiveTab("logo-fixer")
    toast.success("Hasil AI Generator dikirim ke Logo Fixer AI")
  }

  const fixLogo = async () => {
    if (!logoFixerSource) {
      const message = "Pilih gambar dari AI Generator atau upload gambar manual terlebih dahulu"
      setError(message)
      toast.error(message)
      return
    }

    setIsFixingLogo(true)
    setError(null)
    setLogoFixerResult(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 180000)

    try {
      const response = await fetch("/api/instagram-logo-fixer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImage: logoFixerSource.image,
          sourceName: logoFixerSource.name,
          customLogo: logoFixerCustomLogo,
        }),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => null) as LogoFixerResult & { error?: string } | null
      if (!response.ok || !data?.image) {
        throw new Error(data?.error || "Gagal memperbaiki logo")
      }
      setLogoFixerResult(data)
      toast.success("Logo pada saku/helm berhasil diperbaiki")
    } catch (err) {
      const message = err instanceof Error ? (err.name === "AbortError" ? "Waktu proses Logo Fixer AI habis" : err.message) : "Gagal memperbaiki logo"
      setError(message)
      toast.error(message)
    } finally {
      clearTimeout(timeout)
      setIsFixingLogo(false)
    }
  }

  const removeAsset = (url: string) => {
    setUploadedAssets((current) => current.filter((asset) => asset.url !== url))
  }

  const removeCategoryAsset = (
    url: string,
    setAssets: React.Dispatch<React.SetStateAction<UploadedAsset[]>>,
  ) => {
    setAssets((current) => current.filter((asset) => asset.url !== url))
  }


  const copyWearpackStyle = async () => {
    try {
      await navigator.clipboard.writeText(wearpackStylePrompt)
      toast.success("Style wearpack berhasil disalin")
    } catch {
      setPrompt((current) => `${current.trim()}\n\n${wearpackStylePrompt}`.trim())
      toast.success("Clipboard tidak tersedia, style wearpack ditambahkan ke prompt")
    }
  }

  const copyGalleryLogoStyle = async () => {
    try {
      await navigator.clipboard.writeText(galleryLogoPrompt)
      toast.success("Style Gallery & Logo CP berhasil disalin")
    } catch {
      setPrompt((current) => `${current.trim()}\n\n${galleryLogoPrompt}`.trim())
      toast.success("Clipboard tidak tersedia, style Gallery & Logo CP ditambahkan ke prompt")
    }
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
        <TabsList className="grid w-full grid-cols-3 sm:w-fit">
          <TabsTrigger value="generator">AI Generator</TabsTrigger>
          <TabsTrigger value="overlay">Bingkai / Overlay</TabsTrigger>
          <TabsTrigger value="logo-fixer">Logo Fixer AI</TabsTrigger>
        </TabsList>

        <TabsContent value="generator" className="mt-0">
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Konfigurasi Konten</CardTitle>
                <CardDescription>Isi prompt, pilih kebutuhan konten, dan unggah referensi visual bila ada.</CardDescription>
              </div>
              <Link href="/dashboard/marketing/instagram-generator/history">
                <Button variant="outline" size="sm">
                  <HistoryIcon className="mr-2 h-4 w-4" />
                  Riwayat
                </Button>
              </Link>
            </div>
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

            {/* ── Ucapan Ulang Tahun Customer ── */}
          {contentType === "Ucapan ulang tahun customer" && (
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detail Ucapan Ulang Tahun</p>
              <div className="grid gap-1.5">
                <Label>Headline <span className="text-muted-foreground font-normal">(opsional — kosongkan untuk auto)</span></Label>
                <Input value={birthdayHeadline} onChange={(e) => setBirthdayHeadline(e.target.value)} placeholder="Contoh: Selamat Ulang Tahun ke-25, PT Berkah Mining!" />
              </div>
              <div className="grid gap-1.5">
                <Label>Nama Customer / Perusahaan</Label>
                <Input value={birthdayCustomerName} onChange={(e) => setBirthdayCustomerName(e.target.value)} placeholder="Contoh: PT Berkah Mining" />
              </div>
              <div className="grid gap-1.5">
                <Label>Ulang Tahun Ke</Label>
                <Input value={birthdayAge} onChange={(e) => setBirthdayAge(e.target.value)} placeholder="Contoh: 25" type="number" min="1" />
              </div>
              <div className="grid gap-1.5">
                <Label>Custom Ucapan <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                <Textarea value={birthdayCustomGreeting} onChange={(e) => setBirthdayCustomGreeting(e.target.value)} placeholder="Contoh: Semoga semakin sukses dan menjadi partner terpercaya..." className="min-h-20" />
              </div>
              <div className="grid gap-1.5">
                <Label>Logo Perusahaan Customer <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onCategoryFilesChange(e, birthdayLogoAssets, setBirthdayLogoAssets, 1)} disabled={isUploading || birthdayLogoAssets.length >= 1} />
                <p className="text-xs text-muted-foreground">Upload logo customer agar muncul dalam desain ucapan.</p>
                {birthdayLogoAssets.map((asset) => (
                  <div key={asset.url} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs">
                    <span className="truncate">{asset.filename}</span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeCategoryAsset(asset.url, setBirthdayLogoAssets)}>Hapus</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Edukasi ── */}
          {contentType === "Edukasi" && (
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detail Konten Edukasi</p>
              <div className="grid gap-1.5">
                <Label>Headline <span className="text-muted-foreground font-normal">(opsional — kosongkan untuk auto)</span></Label>
                <Input value={eduHeadline} onChange={(e) => setEduHeadline(e.target.value)} placeholder="Contoh: 5 Tips Merawat Ban Truk Tambang" />
              </div>
              <div className="grid gap-1.5">
                <Label>Topik Edukasi</Label>
                <Input value={eduTopic} onChange={(e) => setEduTopic(e.target.value)} placeholder="Contoh: Cara cek tekanan ban yang benar" />
              </div>
              <div className="grid gap-1.5">
                <Label>Poin Utama <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                <Textarea value={eduKeyPoints} onChange={(e) => setEduKeyPoints(e.target.value)} placeholder="Contoh: 1. Cek setiap minggu, 2. Tekanan ideal 32-35 PSI, 3. Cek saat ban dingin" className="min-h-20" />
              </div>
              <div className="grid gap-1.5">
                <Label>Foto Referensi <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                <Input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => onCategoryFilesChange(e, eduPhotoAssets, setEduPhotoAssets, 4)} disabled={isUploading || eduPhotoAssets.length >= 4} />
                <p className="text-xs text-muted-foreground">Foto produk atau situasi kerja sebagai referensi visual.</p>
                {eduPhotoAssets.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {eduPhotoAssets.map((asset) => (
                      <div key={asset.url} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs">
                        <span className="truncate">{asset.filename}</span>
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeCategoryAsset(asset.url, setEduPhotoAssets)}>Hapus</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Pencapaian Perusahaan ── */}
          {contentType === "Pencapaian perusahaan" && (
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detail Pencapaian Perusahaan</p>
              <div className="grid gap-1.5">
                <Label>Headline <span className="text-muted-foreground font-normal">(opsional — kosongkan untuk auto)</span></Label>
                <Input value={achievementHeadline} onChange={(e) => setAchievementHeadline(e.target.value)} placeholder="Contoh: 1 Juta Jam Kerja Aman — Terima Kasih!" />
              </div>
              <div className="grid gap-1.5">
                <Label>Nama Pencapaian</Label>
                <Input value={achievementName} onChange={(e) => setAchievementName(e.target.value)} placeholder="Contoh: 1 Juta Jam Kerja Aman" />
              </div>
              <div className="grid gap-1.5">
                <Label>Angka / Statistik <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                <Input value={achievementStat} onChange={(e) => setAchievementStat(e.target.value)} placeholder="Contoh: 1.000.000 jam, 500 pelanggan, 10 tahun" />
              </div>
              <div className="grid gap-1.5">
                <Label>Deskripsi Singkat <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                <Textarea value={achievementDesc} onChange={(e) => setAchievementDesc(e.target.value)} placeholder="Contoh: Pencapaian ini merupakan bukti komitmen kami dalam keselamatan kerja..." className="min-h-20" />
              </div>
              <div className="grid gap-1.5">
                <Label>Foto Pencapaian <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                <Input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => onCategoryFilesChange(e, achievementPhotoAssets, setAchievementPhotoAssets, 4)} disabled={isUploading || achievementPhotoAssets.length >= 4} />
                {achievementPhotoAssets.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {achievementPhotoAssets.map((asset) => (
                      <div key={asset.url} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs">
                        <span className="truncate">{asset.filename}</span>
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeCategoryAsset(asset.url, setAchievementPhotoAssets)}>Hapus</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Event Perusahaan ── */}
          {contentType === "Event perusahaan" && (
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detail Event Perusahaan</p>
              <div className="grid gap-1.5">
                <Label>Headline <span className="text-muted-foreground font-normal">(opsional — kosongkan untuk auto)</span></Label>
                <Input value={eventHeadline} onChange={(e) => setEventHeadline(e.target.value)} placeholder="Contoh: Customer Gathering 2026 — Bersama Lebih Kuat" />
              </div>
              <div className="grid gap-1.5">
                <Label>Nama Event</Label>
                <Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Contoh: Customer Gathering 2026" />
              </div>
              <div className="grid gap-1.5">
                <Label>Lokasi & Tanggal</Label>
                <Input value={eventLocationDate} onChange={(e) => setEventLocationDate(e.target.value)} placeholder="Contoh: Balikpapan, 20 Mei 2026" />
              </div>
              <div className="grid gap-1.5">
                <Label>Deskripsi Event <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                <Textarea value={eventDesc} onChange={(e) => setEventDesc(e.target.value)} placeholder="Contoh: Acara gathering tahunan bersama pelanggan setia PT Chitra Paratama..." className="min-h-20" />
              </div>
              <div className="grid gap-1.5">
                <Label>Foto Kegiatan <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                <Input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => onCategoryFilesChange(e, eventPhotoAssets, setEventPhotoAssets, 4)} disabled={isUploading || eventPhotoAssets.length >= 4} />
                {eventPhotoAssets.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {eventPhotoAssets.map((asset) => (
                      <div key={asset.url} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs">
                        <span className="truncate">{asset.filename}</span>
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeCategoryAsset(asset.url, setEventPhotoAssets)}>Hapus</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Promosi Produk ── */}
          {contentType === "Promosi produk" && (
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detail Promosi Produk</p>
              <div className="grid gap-1.5">
                <Label>Headline <span className="text-muted-foreground font-normal">(opsional — kosongkan untuk auto)</span></Label>
                <Input value={promoHeadline} onChange={(e) => setPromoHeadline(e.target.value)} placeholder="Contoh: Ban Michelin Terbaik untuk Armada Anda" />
              </div>
              <div className="grid gap-1.5">
                <Label>Nama Produk / Layanan</Label>
                <Input value={promoProductName} onChange={(e) => setPromoProductName(e.target.value)} placeholder="Contoh: Ban Michelin XZE2+, Layanan Fleet Check" />
              </div>
              <div className="grid gap-1.5">
                <Label>Keunggulan Produk <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                <Textarea value={promoHighlights} onChange={(e) => setPromoHighlights(e.target.value)} placeholder="Contoh: Tahan lama, hemat BBM, cocok untuk truk tambang, garansi resmi Michelin" className="min-h-20" />
              </div>
              <div className="grid gap-1.5">
                <Label>Call to Action <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                <Input value={promoCta} onChange={(e) => setPromoCta(e.target.value)} placeholder="Contoh: Hubungi kami sekarang, Dapatkan penawaran terbaik" />
              </div>
              <div className="grid gap-1.5">
                <Label>Foto Produk <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                <Input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => onCategoryFilesChange(e, promoPhotoAssets, setPromoPhotoAssets, 4)} disabled={isUploading || promoPhotoAssets.length >= 4} />
                <p className="text-xs text-muted-foreground">Foto produk atau katalog sebagai referensi visual.</p>
                {promoPhotoAssets.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {promoPhotoAssets.map((asset) => (
                      <div key={asset.url} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs">
                        <span className="truncate">{asset.filename}</span>
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeCategoryAsset(asset.url, setPromoPhotoAssets)}>Hapus</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Hari Nasional ── */}
          {contentType === "Hari Nasional" && (
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detail Hari Nasional</p>
              <div className="grid gap-1.5">
                <Label>Headline <span className="text-muted-foreground font-normal">(opsional — kosongkan untuk auto)</span></Label>
                <Input value={holidayHeadline} onChange={(e) => setHolidayHeadline(e.target.value)} placeholder="Contoh: Selamat Hari Kemerdekaan RI ke-80" />
              </div>
              <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                {isLoadingHoliday ? "Mengambil Hari Nasional terdekat..." : nearestHoliday ? `Hari Nasional terdekat: ${nearestHoliday.name} (${formatDate(nearestHoliday.date)})` : "Hari Nasional belum tersedia"}
              </div>
              <div className="grid gap-1.5">
                <Label>Pesan Khusus <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                <Textarea value={holidayCustomMessage} onChange={(e) => setHolidayCustomMessage(e.target.value)} placeholder="Contoh: Semoga semangat kemerdekaan terus menginspirasi kita semua..." className="min-h-20" />
              </div>
            </div>
          )}
          {/* ── Tampilkan Orang / Wearpack Toggle ── */}
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="show-person-toggle"
                checked={showPerson}
                onChange={(e) => {
                  setShowPerson(e.target.checked)
                  if (!e.target.checked) setPersonActivity("")
                }}
                className="size-4 rounded border-input accent-primary cursor-pointer"
              />
              <label htmlFor="show-person-toggle" className="cursor-pointer text-sm font-medium leading-none">
                Tampilkan orang / pekerja dalam gambar
              </label>
            </div>
            {showPerson && (
              <div className="mt-3 grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Kegiatan yang dilakukan <span className="font-normal">(opsional)</span></Label>
                <Input
                  value={personActivity}
                  onChange={(e) => setPersonActivity(e.target.value)}
                  placeholder="Contoh: memeriksa ban truk, berdiri di depan armada, melakukan servis"
                />
                <p className="text-xs text-muted-foreground">Pekerja akan memakai wearpack safety TWO-TONE resmi PT Chitra Paratama secara otomatis.</p>
              </div>
            )}
            {!showPerson && (
              <p className="mt-2 text-xs text-muted-foreground">Gambar akan fokus pada objek, produk, atau elemen grafis tanpa orang.</p>
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
              <Label>Pilih overlay</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={generatorOverlayVariant === "standard" ? "default" : "outline"} onClick={() => setGeneratorOverlayVariant("standard")} className="h-auto flex-col gap-1 py-3">
                  <span>Standar</span>
                  <span className="text-xs font-normal opacity-80">{getOverlayTemplateName(format, "standard")}</span>
                </Button>
                <Button type="button" variant={generatorOverlayVariant === "white" ? "default" : "outline"} onClick={() => setGeneratorOverlayVariant("white")} className="h-auto flex-col gap-1 py-3">
                  <span>Putih</span>
                  <span className="text-xs font-normal opacity-80">{getOverlayTemplateName(format, "white")}</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Overlay dipasang setelah gambar AI selesai dibuat.</p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Prompt</Label>
                <div className="flex flex-wrap justify-end gap-2">
                                    <Button type="button" variant="secondary" size="sm" onClick={copyWearpackStyle}>
                    <Clipboard className="size-4" />
                    Copy Style Wearpack
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={copyGalleryLogoStyle}>
                    <Clipboard className="size-4" />
                    Copy Gallery &amp; Logo CP
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={enhancePrompt} disabled={isEnhancing || isGenerating || isUploading}>
                    {isEnhancing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {isEnhancing ? "Enhancing..." : "Enhance Prompt"}
                  </Button>
                </div>
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
                  {variationResults.map((variation, index) => (
                    <Button key={`logo-fixer-${index}`} onClick={() => sendToLogoFixer(variation, `variasi-${index + 1}.png`)} variant="outline" className="w-full sm:w-fit">
                      <ShieldCheck className="size-4" />
                      Kirim Variasi {index + 1} ke Logo Fixer AI
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
                <Button onClick={() => sendToLogoFixer(result)} variant="outline" className="w-full sm:w-fit">
                  <ShieldCheck className="size-4" />
                  Kirim ke Logo Fixer AI
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="overlay" className="mt-0">
          <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Bingkai / Overlay</CardTitle>
                <CardDescription>Upload gambar lalu sistem akan crop, resize, dan menempelkan template Feed atau Story otomatis.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <Label>Pilih Ukuran</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button type="button" variant={overlayFormat === "feed" ? "default" : "outline"} onClick={() => setOverlayFormat("feed")} className="h-auto flex-col gap-1 py-3">
                      <span>Feed</span>
                      <span className="text-xs font-normal opacity-80">1080 × 1350 px</span>
                    </Button>
                    <Button type="button" variant={overlayFormat === "story" ? "default" : "outline"} onClick={() => setOverlayFormat("story")} className="h-auto flex-col gap-1 py-3">
                      <span>Story</span>
                      <span className="text-xs font-normal opacity-80">1080 × 1920 px</span>
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Preview otomatis dua overlay</p>
                  <p>Setelah upload, sistem langsung membuat versi Standar ({getOverlayTemplateName(overlayFormat, "standard")}) dan Putih ({getOverlayTemplateName(overlayFormat, "white")}) sekaligus.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="overlay-upload">Upload gambar</Label>
                  <div className="rounded-xl border border-dashed p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start gap-3 text-sm text-muted-foreground">
                        <UploadCloud className="mt-0.5 size-5" />
                        <div>
                          <p className="font-medium text-foreground">Pilih JPG, PNG, atau WebP</p>
                          <p>Gambar akan otomatis disesuaikan ke ukuran {overlayFormat === "story" ? "Story" : "Feed"}, lalu dibuat versi Standar dan Putih.</p>
                        </div>
                      </div>
                      <Input id="overlay-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={onOverlayFileChange} disabled={isComposingOverlay} />
                    </div>
                  </div>
                </div>

                {overlayFileName && (
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    <p><span className="font-medium">File:</span> {overlayFileName}</p>
                    <p><span className="font-medium">Output:</span> Standar dan Putih</p>
                  </div>
                )}

                {isComposingOverlay && (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Menyesuaikan ukuran dan memasang overlay...
                  </div>
                )}

                {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preview Bingkai</CardTitle>
                <CardDescription>Lihat versi Standar dan Putih sekaligus untuk Instagram {overlayFormat === "story" ? "Story" : "Feed"}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex min-h-[520px] items-center justify-center rounded-xl border bg-muted/40 p-4">
                  {overlayResults.length > 0 ? (
                    <div className="grid w-full gap-4 lg:grid-cols-2">
                      {overlayResults.map((overlayResult) => (
                        <div key={overlayResult.overlayVariant} className="space-y-2">
                          <div className="text-center text-sm font-medium">Overlay {overlayVariantLabels[overlayResult.overlayVariant]}</div>
                          <Image
                            src={overlayResult.image}
                            alt={`Preview gambar Instagram ${overlayResult.format} overlay ${overlayVariantLabels[overlayResult.overlayVariant]}`}
                            width={overlayResult.width}
                            height={overlayResult.height}
                            className="max-h-[620px] w-auto rounded-lg object-contain shadow-xl"
                            unoptimized
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex max-w-md flex-col items-center gap-3 text-center text-muted-foreground">
                      <UploadCloud className="size-12" />
                      <div>
                        <p className="font-medium text-foreground">Belum ada gambar overlay</p>
                        <p className="text-sm">Pilih format Feed atau Story, lalu upload gambar untuk melihat versi Standar dan Putih.</p>
                      </div>
                    </div>
                  )}
                </div>

                {overlayResults.length > 0 && (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {overlayResults.map((overlayResult) => (
                      <div key={`meta-${overlayResult.overlayVariant}`} className="flex flex-col gap-3 rounded-xl border p-4">
                        <div className="grid gap-1 text-sm">
                          <p><span className="font-medium">Overlay:</span> {overlayVariantLabels[overlayResult.overlayVariant]}</p>
                          <p><span className="font-medium">Resolusi:</span> {overlayResult.width} × {overlayResult.height}px</p>
                          <p><span className="font-medium">Template:</span> {overlayResult.template}</p>
                          <p><span className="font-medium">Format:</span> PNG</p>
                        </div>
                        <Button onClick={() => downloadImage(overlayResult.image, `overlay-${overlayResult.format}-${overlayResult.overlayVariant}`)} variant="secondary" className="w-full sm:w-fit">
                          <Download className="size-4" />
                          Download {overlayVariantLabels[overlayResult.overlayVariant]}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logo-fixer" className="mt-0">
          <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Logo Fixer AI</CardTitle>
                <CardDescription>Perbaiki hanya logo hasil AI di patch saku kiri wearpack dan helm safety; footer serta logo overlay kiri atas tidak disentuh.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-5 text-primary" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">Tugas khusus</p>
                      <p className="text-muted-foreground">Replace hanya logo hasil generate di saku kiri dan helm safety. Footer serta logo resmi di kiri atas harus tetap sama.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Gambar yang akan diperbaiki</Label>
                  <div className="rounded-xl border border-dashed p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start gap-3 text-sm text-muted-foreground">
                        <UploadCloud className="mt-0.5 size-5" />
                        <div>
                          <p className="font-medium text-foreground">Ambil dari AI Generator atau upload manual</p>
                          <p>Tombol di preview AI Generator bisa langsung mengirim hasil ke tab ini.</p>
                        </div>
                      </div>
                      <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={onLogoFixerSourceChange} disabled={isFixingLogo} />
                    </div>
                  </div>
                  {logoFixerSource && (
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                      <p><span className="font-medium">Sumber:</span> {logoFixerSource.name}</p>
                      {logoFixerSource.width && logoFixerSource.height && <p><span className="font-medium">Resolusi:</span> {logoFixerSource.width} × {logoFixerSource.height}px</p>}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>Logo pengganti</Label>
                  <div className="grid gap-3 rounded-xl border p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex size-24 items-center justify-center rounded-lg border bg-white p-2">
                        <Image
                          src={logoFixerCustomLogo || "/cp_logo.png"}
                          alt="Preview logo pengganti"
                          width={160}
                          height={80}
                          className="max-h-20 w-auto object-contain"
                          unoptimized
                        />
                      </div>
                      <div className="space-y-1 text-sm">
                        <p className="font-medium">{logoFixerCustomLogoName || "cp_logo.png"}</p>
                        <p className="text-muted-foreground">Default memakai logo CP resmi. Upload logo custom akan mengganti seluruh logo target di gambar.</p>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="logo-fixer-custom-logo">Upload logo custom</Label>
                      <Input id="logo-fixer-custom-logo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onLogoFixerCustomLogoChange} disabled={isFixingLogo} />
                      {logoFixerCustomLogo && (
                        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => { setLogoFixerCustomLogo(null); setLogoFixerCustomLogoName("") }} disabled={isFixingLogo}>
                          Pakai cp_logo.png lagi
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

                <Button onClick={fixLogo} disabled={isFixingLogo || !logoFixerSource} className="w-full">
                  {isFixingLogo ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  {isFixingLogo ? "Memperbaiki logo..." : "Fix Logo di Saku & Helm"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preview Logo Fixer</CardTitle>
                <CardDescription>Bandingkan gambar sumber dan hasil setelah logo diganti.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Sumber</p>
                    <div className="flex min-h-[420px] items-center justify-center rounded-xl border bg-muted/40 p-4">
                      {logoFixerSource ? (
                        <Image
                          src={logoFixerSource.image}
                          alt="Gambar sumber Logo Fixer AI"
                          width={logoFixerSource.width || 1080}
                          height={logoFixerSource.height || 1350}
                          className="max-h-[560px] w-auto rounded-lg object-contain shadow-xl"
                          unoptimized
                        />
                      ) : (
                        <div className="flex max-w-sm flex-col items-center gap-3 text-center text-muted-foreground">
                          <ImagePlus className="size-10" />
                          <p className="text-sm">Belum ada gambar sumber.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Hasil Fix</p>
                    <div className="flex min-h-[420px] items-center justify-center rounded-xl border bg-muted/40 p-4">
                      {logoFixerResult ? (
                        <Image
                          src={logoFixerResult.image}
                          alt="Hasil Logo Fixer AI"
                          width={logoFixerResult.width || 1080}
                          height={logoFixerResult.height || 1350}
                          className="max-h-[560px] w-auto rounded-lg object-contain shadow-xl"
                          unoptimized
                        />
                      ) : (
                        <div className="flex max-w-sm flex-col items-center gap-3 text-center text-muted-foreground">
                          <ShieldCheck className="size-10" />
                          <p className="text-sm">Klik Fix Logo untuk memperbaiki patch saku kiri dan helm safety.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {logoFixerResult && (
                  <div className="flex flex-col gap-3 rounded-xl border p-4">
                    <div className="grid gap-1 text-sm">
                      <p><span className="font-medium">Resolusi:</span> {logoFixerResult.width} × {logoFixerResult.height}px</p>
                      <p><span className="font-medium">Logo:</span> {logoFixerResult.logoSource}</p>
                      <p><span className="font-medium">Format:</span> PNG</p>
                    </div>
                    <Button onClick={() => downloadImage(logoFixerResult.image, "logo-fixer-ai")} variant="secondary" className="w-full sm:w-fit">
                      <Download className="size-4" />
                      Download PNG
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

