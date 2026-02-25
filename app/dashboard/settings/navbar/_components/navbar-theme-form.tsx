"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Palette, RotateCcw, Save } from "lucide-react"
import { toast } from "sonner"

import { resetNavbarThemeAction, saveNavbarThemeAction } from "@/app/actions/navbar-theme"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import type { NavbarTheme } from "@/lib/navbar-theme"

type Props = {
    initialTheme: NavbarTheme
}

export function NavbarThemeForm({ initialTheme }: Props) {
    const router = useRouter()
    const [isSaving, startSaveTransition] = useTransition()
    const [isResetting, startResetTransition] = useTransition()
    const [theme, setTheme] = useState<NavbarTheme>(initialTheme)

    const isBusy = isSaving || isResetting

    const onSave = () => {
        startSaveTransition(async () => {
            const result = await saveNavbarThemeAction(theme)
            if (!result.success) {
                toast.error(result.error ?? "Failed to save navbar theme")
                return
            }

            toast.success("Navbar theme updated")
            router.refresh()
        })
    }

    const onReset = () => {
        startResetTransition(async () => {
            const result = await resetNavbarThemeAction()
            if (!result.success) {
                toast.error(result.error ?? "Failed to reset navbar theme")
                return
            }

            if (result.data) {
                setTheme(result.data)
            }
            toast.success("Navbar theme reset to white")
            router.refresh()
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Navbar Theme
                </CardTitle>
                <CardDescription>
                    Pengaturan ini berlaku global untuk semua role di dashboard.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                        <Label htmlFor="navbar-bg">Warna Navbar</Label>
                        <input
                            id="navbar-bg"
                            type="color"
                            value={theme.navbarBg}
                            onChange={(event) => setTheme((prev) => ({ ...prev, navbarBg: event.target.value }))}
                            className="h-10 w-full cursor-pointer rounded-md border bg-background p-1"
                            disabled={isBusy}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="active-bg">Warna Active Button</Label>
                        <input
                            id="active-bg"
                            type="color"
                            value={theme.activeBg}
                            onChange={(event) => setTheme((prev) => ({ ...prev, activeBg: event.target.value }))}
                            className="h-10 w-full cursor-pointer rounded-md border bg-background p-1"
                            disabled={isBusy}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="font-color">Warna Font Navbar</Label>
                        <input
                            id="font-color"
                            type="color"
                            value={theme.fontColor}
                            onChange={(event) => setTheme((prev) => ({ ...prev, fontColor: event.target.value }))}
                            className="h-10 w-full cursor-pointer rounded-md border bg-background p-1"
                            disabled={isBusy}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="section-color">Warna Teks Section</Label>
                        <input
                            id="section-color"
                            type="color"
                            value={theme.sectionColor}
                            onChange={(event) => setTheme((prev) => ({ ...prev, sectionColor: event.target.value }))}
                            className="h-10 w-full cursor-pointer rounded-md border bg-background p-1"
                            disabled={isBusy}
                        />
                    </div>
                </div>

                <div className="rounded-lg border p-4">
                    <p className="mb-3 text-sm font-medium">Preview</p>
                    <div className="space-y-2 rounded-md border p-3" style={{ backgroundColor: theme.navbarBg, color: theme.fontColor }}>
                        <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: theme.sectionColor }}>
                            SCM Management
                        </div>
                        <div className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: theme.activeBg, color: "#ffffff" }}>
                            Menu Active
                        </div>
                        <div className="px-3 py-2 text-sm">Menu Normal</div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={onSave} disabled={isBusy} className="gap-2">
                        <Save className="h-4 w-4" />
                        {isSaving ? "Saving..." : "Simpan"}
                    </Button>

                    <Button type="button" variant="outline" onClick={onReset} disabled={isBusy} className="gap-2">
                        <RotateCcw className="h-4 w-4" />
                        {isResetting ? "Resetting..." : "Reset ke Putih"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
