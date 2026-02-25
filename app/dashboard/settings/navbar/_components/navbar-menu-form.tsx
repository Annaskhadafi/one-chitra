"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    CheckCircle2,
    ChevronRight,
    EyeOff,
    Link2,
    ListTree,
    Plus,
    RefreshCcw,
    Save,
    Settings2,
    SquareArrowOutUpRight,
    Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { resetNavbarMenuSettingsAction, saveNavbarMenuSettingsAction } from "@/app/actions/navbar-menu"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
    getIconByName,
    NAVBAR_ICON_OPTIONS,
    type EditableNavItem,
    type EditableNavSection,
    type EditableNavSubItem,
} from "@/lib/navigation-menu"

type Props = {
    initialConfig: EditableNavSection[]
}

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`

const move = <T,>(list: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= list.length) {
        return list
    }
    const next = [...list]
    const [picked] = next.splice(from, 1)
    next.splice(to, 0, picked)
    return next
}

const isValidExternalUrl = (value: string) => {
    const raw = value.trim()
    if (!raw) {
        return false
    }

    const normalized = raw.startsWith("http://") || raw.startsWith("https://")
        ? raw
        : `https://${raw.replace(/^\/+/, "")}`

    try {
        const parsed = new URL(normalized)
        return parsed.protocol === "http:" || parsed.protocol === "https:"
    } catch {
        return false
    }
}

export function NavbarMenuForm({ initialConfig }: Props) {
    const router = useRouter()
    const [isSaving, startSaveTransition] = useTransition()
    const [isResetting, startResetTransition] = useTransition()
    const [sections, setSections] = useState<EditableNavSection[]>(initialConfig)

    const isBusy = isSaving || isResetting

    const hasInvalidExternalLinks = sections.some((section) =>
        section.items.some((item) => {
            const invalidItem = item.isCustom && item.linkType === "external" && !isValidExternalUrl(item.url)
            const invalidSubItem = item.items.some(
                (subItem) => subItem.isCustom && subItem.linkType === "external" && !isValidExternalUrl(subItem.url),
            )
            return invalidItem || invalidSubItem
        }),
    )

    const updateItem = (sectionId: string, itemId: string, updater: (item: EditableNavItem) => EditableNavItem) => {
        setSections((prev) =>
            prev.map((section) => {
                if (section.id !== sectionId) {
                    return section
                }
                return {
                    ...section,
                    items: section.items.map((item) => (item.id === itemId ? updater(item) : item)),
                }
            }),
        )
    }

    const updateSubItem = (
        sectionId: string,
        itemId: string,
        subItemId: string,
        updater: (subItem: EditableNavSubItem) => EditableNavSubItem,
    ) => {
        updateItem(sectionId, itemId, (item) => ({
            ...item,
            items: item.items.map((subItem) => (subItem.id === subItemId ? updater(subItem) : subItem)),
        }))
    }

    const addCustomItem = (sectionId: string) => {
        setSections((prev) =>
            prev.map((section) => {
                if (section.id !== sectionId) {
                    return section
                }
                return {
                    ...section,
                    items: [
                        ...section.items,
                        {
                            id: createId("item"),
                            title: "Custom Link",
                            url: "/dashboard/custom-link",
                            iconName: "Link2",
                            resource: null,
                            hidden: false,
                            openInNewTab: false,
                            isCustom: true,
                            linkType: "internal",
                            externalOpenMode: "new_tab",
                            items: [],
                        },
                    ],
                }
            }),
        )
    }

    const removeCustomItem = (sectionId: string, itemId: string) => {
        setSections((prev) =>
            prev.map((section) => {
                if (section.id !== sectionId) {
                    return section
                }

                const target = section.items.find((item) => item.id === itemId)
                if (!target?.isCustom) {
                    return section
                }

                return {
                    ...section,
                    items: section.items.filter((item) => item.id !== itemId),
                }
            }),
        )
    }

    const addSubItem = (sectionId: string, itemId: string) => {
        updateItem(sectionId, itemId, (item) => ({
            ...item,
            items: [
                ...item.items,
                {
                    id: createId("sub"),
                    title: "Sub Menu",
                    url: "/dashboard/submenu",
                    resource: null,
                    hidden: false,
                    openInNewTab: false,
                    isCustom: true,
                    linkType: "internal",
                    externalOpenMode: "new_tab",
                },
            ],
        }))
    }

    const removeCustomSubItem = (sectionId: string, itemId: string, subItemId: string) => {
        updateItem(sectionId, itemId, (item) => {
            const target = item.items.find((subItem) => subItem.id === subItemId)
            if (!target?.isCustom) {
                return item
            }

            return {
                ...item,
                items: item.items.filter((subItem) => subItem.id !== subItemId),
            }
        })
    }

    const onSave = () => {
        startSaveTransition(async () => {
            const result = await saveNavbarMenuSettingsAction(sections)
            if (!result.success) {
                toast.error(result.error ?? "Gagal menyimpan menu navbar")
                return
            }
            toast.success("Pengaturan menu navbar berhasil disimpan")
            router.refresh()
        })
    }

    const onReset = () => {
        startResetTransition(async () => {
            const result = await resetNavbarMenuSettingsAction()
            if (!result.success) {
                toast.error(result.error ?? "Gagal reset menu navbar")
                return
            }

            if (result.data) {
                setSections(result.data)
            }
            toast.success("Menu navbar berhasil direset ke default")
            router.refresh()
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    Navbar Menu Settings
                </CardTitle>
                <CardDescription>
                    Atur urutan menu, submenu, delete custom link, reset, internal/external link, serta mode iframe untuk external.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="space-y-6">
                    {sections.map((section, sectionIndex) => (
                        <div key={section.id} className="space-y-4 rounded-lg border p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Section</p>
                                    <h3 className="text-base font-semibold">{section.title}</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSections((prev) => move(prev, sectionIndex, sectionIndex - 1))}
                                        disabled={sectionIndex === 0 || isBusy}
                                    >
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSections((prev) => move(prev, sectionIndex, sectionIndex + 1))}
                                        disabled={sectionIndex === sections.length - 1 || isBusy}
                                    >
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => addCustomItem(section.id)}
                                        disabled={isBusy}
                                        className="gap-1"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Custom Link
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {section.items.map((item, itemIndex) => {
                                    const IconPreview = getIconByName(item.iconName)
                                    const isExternal = item.linkType === "external"

                                    return (
                                        <Collapsible key={item.id} defaultOpen={itemIndex === 0} className="rounded-md border p-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <CollapsibleTrigger asChild>
                                                        <Button type="button" variant="ghost" size="sm" className="gap-1 px-2">
                                                            <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                                                            <span className="text-sm font-medium">{item.title || "Menu"}</span>
                                                        </Button>
                                                    </CollapsibleTrigger>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {item.isCustom && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => removeCustomItem(section.id, item.id)}
                                                            disabled={isBusy}
                                                            className="gap-1 text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" /> Delete
                                                        </Button>
                                                    )}
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            setSections((prev) =>
                                                                prev.map((s) =>
                                                                    s.id === section.id
                                                                        ? { ...s, items: move(s.items, itemIndex, itemIndex - 1) }
                                                                        : s,
                                                                ),
                                                            )
                                                        }
                                                        disabled={itemIndex === 0 || isBusy}
                                                    >
                                                        <ArrowUp className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            setSections((prev) =>
                                                                prev.map((s) =>
                                                                    s.id === section.id
                                                                        ? { ...s, items: move(s.items, itemIndex, itemIndex + 1) }
                                                                        : s,
                                                                ),
                                                            )
                                                        }
                                                        disabled={itemIndex === section.items.length - 1 || isBusy}
                                                    >
                                                        <ArrowDown className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <CollapsibleContent className="space-y-3 pt-3">

                                            <div className="grid gap-3 md:grid-cols-3">
                                                <div className="space-y-1">
                                                    <Label>Judul Menu</Label>
                                                    <Input
                                                        value={item.title}
                                                        onChange={(event) =>
                                                            updateItem(section.id, item.id, (target) => ({
                                                                ...target,
                                                                title: event.target.value,
                                                            }))
                                                        }
                                                        disabled={isBusy}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>{isExternal ? "URL External" : "URL"}</Label>
                                                    <Input
                                                        value={item.url}
                                                        onChange={(event) =>
                                                            updateItem(section.id, item.id, (target) => ({
                                                                ...target,
                                                                url: event.target.value,
                                                            }))
                                                        }
                                                        disabled={isBusy}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>Icon</Label>
                                                    <Select
                                                        value={item.iconName}
                                                        onValueChange={(value) =>
                                                            updateItem(section.id, item.id, (target) => ({
                                                                ...target,
                                                                iconName: value,
                                                            }))
                                                        }
                                                        disabled={isBusy}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Pilih icon" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {NAVBAR_ICON_OPTIONS.map((iconName) => (
                                                                <SelectItem key={iconName} value={iconName}>
                                                                    {iconName}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                        <IconPreview className="h-3.5 w-3.5" />
                                                        <span>Preview icon</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {item.isCustom && (
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                                        <Label className="text-sm">External Link</Label>
                                                        <Switch
                                                            checked={isExternal}
                                                            onCheckedChange={(checked) =>
                                                                updateItem(section.id, item.id, (target) => ({
                                                                    ...target,
                                                                    linkType: checked ? "external" : "internal",
                                                                    externalOpenMode: checked ? target.externalOpenMode : "new_tab",
                                                                }))
                                                            }
                                                            disabled={isBusy}
                                                        />
                                                    </div>

                                                    {isExternal && (
                                                        <div className="space-y-1">
                                                            <Label>Mode External</Label>
                                                            <Select
                                                                value={item.externalOpenMode}
                                                                onValueChange={(value: "new_tab" | "iframe") =>
                                                                    updateItem(section.id, item.id, (target) => ({
                                                                        ...target,
                                                                        externalOpenMode: value,
                                                                    }))
                                                                }
                                                                disabled={isBusy}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Pilih mode" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="new_tab">Buka di New Tab</SelectItem>
                                                                    <SelectItem value="iframe">Tampilkan via IFRAME</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            {item.externalOpenMode === "iframe" && (
                                                                <p className="text-xs text-muted-foreground">
                                                                    Link akan dibuka di halaman internal IFRAME sesuai URL yang diisi.
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {item.isCustom && isExternal && (
                                                isValidExternalUrl(item.url) ? (
                                                    <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        URL external menu valid.
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                                                        <AlertTriangle className="h-4 w-4" />
                                                        URL external menu belum valid.
                                                    </div>
                                                )
                                            )}

                                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={item.hidden}
                                                        onCheckedChange={(checked) =>
                                                            updateItem(section.id, item.id, (target) => ({
                                                                ...target,
                                                                hidden: checked,
                                                            }))
                                                        }
                                                        disabled={isBusy}
                                                    />
                                                    <span className="inline-flex items-center gap-1">
                                                        <EyeOff className="h-3.5 w-3.5" /> Hidden
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={isExternal ? item.externalOpenMode !== "iframe" : item.openInNewTab}
                                                        onCheckedChange={(checked) =>
                                                            updateItem(section.id, item.id, (target) => {
                                                                if (target.linkType === "external") {
                                                                    return {
                                                                        ...target,
                                                                        externalOpenMode: checked ? "new_tab" : "iframe",
                                                                    }
                                                                }

                                                                return {
                                                                    ...target,
                                                                    openInNewTab: checked,
                                                                }
                                                            })
                                                        }
                                                        disabled={isBusy}
                                                    />
                                                    <span className="inline-flex items-center gap-1">
                                                        <SquareArrowOutUpRight className="h-3.5 w-3.5" /> New Tab
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={item.isCustom}
                                                        onCheckedChange={(checked) =>
                                                            updateItem(section.id, item.id, (target) => ({
                                                                ...target,
                                                                isCustom: checked,
                                                            }))
                                                        }
                                                        disabled={isBusy}
                                                    />
                                                    <span className="inline-flex items-center gap-1">
                                                        <Link2 className="h-3.5 w-3.5" /> Custom Link
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-2 rounded-md border border-dashed p-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p className="inline-flex items-center gap-1 text-sm font-medium">
                                                        <ListTree className="h-4 w-4" /> Sub Menu
                                                    </p>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-1"
                                                        onClick={() => addSubItem(section.id, item.id)}
                                                        disabled={isBusy}
                                                    >
                                                        <Plus className="h-4 w-4" /> Tambah Submenu
                                                    </Button>
                                                </div>

                                                {item.items.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">Belum ada submenu.</p>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {item.items.map((subItem, subIndex) => {
                                                            const subIsExternal = subItem.linkType === "external"

                                                            return (
                                                                <Collapsible key={subItem.id} defaultOpen={false} className="rounded-md border p-2">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <CollapsibleTrigger asChild>
                                                                            <Button type="button" variant="ghost" size="sm" className="mr-auto gap-1 px-2">
                                                                                <ChevronRight className="h-3.5 w-3.5 transition-transform data-[state=open]:rotate-90" />
                                                                                <span className="text-xs font-medium">{subItem.title || "Submenu"}</span>
                                                                            </Button>
                                                                        </CollapsibleTrigger>
                                                                        {subItem.isCustom && (
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() =>
                                                                                    removeCustomSubItem(section.id, item.id, subItem.id)
                                                                                }
                                                                                disabled={isBusy}
                                                                                className="gap-1 text-destructive"
                                                                            >
                                                                                <Trash2 className="h-3.5 w-3.5" /> Delete
                                                                            </Button>
                                                                        )}
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() =>
                                                                                updateItem(section.id, item.id, (target) => ({
                                                                                    ...target,
                                                                                    items: move(target.items, subIndex, subIndex - 1),
                                                                                }))
                                                                            }
                                                                            disabled={subIndex === 0 || isBusy}
                                                                        >
                                                                            <ArrowUp className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() =>
                                                                                updateItem(section.id, item.id, (target) => ({
                                                                                    ...target,
                                                                                    items: move(target.items, subIndex, subIndex + 1),
                                                                                }))
                                                                            }
                                                                            disabled={subIndex === item.items.length - 1 || isBusy}
                                                                        >
                                                                            <ArrowDown className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>

                                                                    <CollapsibleContent className="space-y-2 pt-2">

                                                                    <div className="grid gap-2 md:grid-cols-2">
                                                                        <Input
                                                                            value={subItem.title}
                                                                            onChange={(event) =>
                                                                                updateSubItem(section.id, item.id, subItem.id, (target) => ({
                                                                                    ...target,
                                                                                    title: event.target.value,
                                                                                }))
                                                                            }
                                                                            disabled={isBusy}
                                                                            placeholder="Judul Submenu"
                                                                        />
                                                                        <Input
                                                                            value={subItem.url}
                                                                            onChange={(event) =>
                                                                                updateSubItem(section.id, item.id, subItem.id, (target) => ({
                                                                                    ...target,
                                                                                    url: event.target.value,
                                                                                }))
                                                                            }
                                                                            disabled={isBusy}
                                                                            placeholder={subIsExternal ? "URL External" : "URL Submenu"}
                                                                        />
                                                                    </div>

                                                                    {subItem.isCustom && (
                                                                        <div className="grid gap-2 md:grid-cols-2">
                                                                            <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                                                                <Label className="text-xs">External Link</Label>
                                                                                <Switch
                                                                                    checked={subIsExternal}
                                                                                    onCheckedChange={(checked) =>
                                                                                        updateSubItem(section.id, item.id, subItem.id, (target) => ({
                                                                                            ...target,
                                                                                            linkType: checked ? "external" : "internal",
                                                                                            externalOpenMode: checked ? target.externalOpenMode : "new_tab",
                                                                                        }))
                                                                                    }
                                                                                    disabled={isBusy}
                                                                                />
                                                                            </div>
                                                                            {subIsExternal && (
                                                                                <Select
                                                                                    value={subItem.externalOpenMode}
                                                                                    onValueChange={(value: "new_tab" | "iframe") =>
                                                                                        updateSubItem(section.id, item.id, subItem.id, (target) => ({
                                                                                            ...target,
                                                                                            externalOpenMode: value,
                                                                                        }))
                                                                                    }
                                                                                    disabled={isBusy}
                                                                                >
                                                                                    <SelectTrigger>
                                                                                        <SelectValue placeholder="Mode external" />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="new_tab">New Tab</SelectItem>
                                                                                        <SelectItem value="iframe">IFRAME</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {subItem.isCustom && subIsExternal && (
                                                                        isValidExternalUrl(subItem.url) ? (
                                                                            <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-2 py-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                                                URL external submenu valid.
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
                                                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                                                URL external submenu belum valid.
                                                                            </div>
                                                                        )
                                                                    )}

                                                                    <div className="flex flex-wrap items-center gap-3 text-xs">
                                                                        <div className="flex items-center gap-2">
                                                                            <Switch
                                                                                checked={subItem.hidden}
                                                                                onCheckedChange={(checked) =>
                                                                                    updateSubItem(section.id, item.id, subItem.id, (target) => ({
                                                                                        ...target,
                                                                                        hidden: checked,
                                                                                    }))
                                                                                }
                                                                                disabled={isBusy}
                                                                            />
                                                                            <span>Hidden</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <Switch
                                                                                checked={subIsExternal ? subItem.externalOpenMode !== "iframe" : subItem.openInNewTab}
                                                                                onCheckedChange={(checked) =>
                                                                                    updateSubItem(section.id, item.id, subItem.id, (target) => {
                                                                                        if (target.linkType === "external") {
                                                                                            return {
                                                                                                ...target,
                                                                                                externalOpenMode: checked ? "new_tab" : "iframe",
                                                                                            }
                                                                                        }

                                                                                        return {
                                                                                            ...target,
                                                                                            openInNewTab: checked,
                                                                                        }
                                                                                    })
                                                                                }
                                                                                disabled={isBusy}
                                                                            />
                                                                            <span>New Tab</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <Switch
                                                                                checked={subItem.isCustom}
                                                                                onCheckedChange={(checked) =>
                                                                                    updateSubItem(section.id, item.id, subItem.id, (target) => ({
                                                                                        ...target,
                                                                                        isCustom: checked,
                                                                                    }))
                                                                                }
                                                                                disabled={isBusy}
                                                                            />
                                                                            <span>Custom Link</span>
                                                                        </div>
                                                                    </div>
                                                                    </CollapsibleContent>
                                                                </Collapsible>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={onSave} disabled={isBusy || hasInvalidExternalLinks} className="gap-2">
                        <Save className="h-4 w-4" />
                        {isSaving ? "Saving..." : "Simpan Pengaturan Menu"}
                    </Button>
                    <Button type="button" variant="outline" onClick={onReset} disabled={isBusy} className="gap-2">
                        <RefreshCcw className="h-4 w-4" />
                        {isResetting ? "Resetting..." : "Reset ke Default"}
                    </Button>
                    {hasInvalidExternalLinks && (
                        <p className="text-xs text-destructive">
                            Perbaiki semua URL external yang invalid sebelum menyimpan.
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
