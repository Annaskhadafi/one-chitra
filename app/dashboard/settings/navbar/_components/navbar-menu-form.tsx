"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
    ArrowDown,
    ArrowUp,
    EyeOff,
    Link2,
    ListTree,
    Plus,
    Save,
    Settings2,
    SquareArrowOutUpRight,
} from "lucide-react"
import { toast } from "sonner"

import { saveNavbarMenuSettingsAction } from "@/app/actions/navbar-menu"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

export function NavbarMenuForm({ initialConfig }: Props) {
    const router = useRouter()
    const [isSaving, startTransition] = useTransition()
    const [sections, setSections] = useState<EditableNavSection[]>(initialConfig)

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
                            items: [],
                        },
                    ],
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
                },
            ],
        }))
    }

    const onSave = () => {
        startTransition(async () => {
            const result = await saveNavbarMenuSettingsAction(sections)
            if (!result.success) {
                toast.error(result.error ?? "Gagal menyimpan menu navbar")
                return
            }
            toast.success("Pengaturan menu navbar berhasil disimpan")
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
                    Atur urutan menu, submenu, icon, hidden, custom link, dan opsi buka di tab baru.
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
                                        onClick={() =>
                                            setSections((prev) => move(prev, sectionIndex, sectionIndex - 1))
                                        }
                                        disabled={sectionIndex === 0 || isSaving}
                                    >
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setSections((prev) => move(prev, sectionIndex, sectionIndex + 1))
                                        }
                                        disabled={sectionIndex === sections.length - 1 || isSaving}
                                    >
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => addCustomItem(section.id)}
                                        disabled={isSaving}
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

                                    return (
                                        <div key={item.id} className="space-y-3 rounded-md border p-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="text-sm font-medium">Menu</p>
                                                <div className="flex items-center gap-2">
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
                                                        disabled={itemIndex === 0 || isSaving}
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
                                                        disabled={itemIndex === section.items.length - 1 || isSaving}
                                                    >
                                                        <ArrowDown className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

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
                                                        disabled={isSaving}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>URL</Label>
                                                    <Input
                                                        value={item.url}
                                                        onChange={(event) =>
                                                            updateItem(section.id, item.id, (target) => ({
                                                                ...target,
                                                                url: event.target.value,
                                                            }))
                                                        }
                                                        disabled={isSaving}
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
                                                        disabled={isSaving}
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
                                                        disabled={isSaving}
                                                    />
                                                    <span className="inline-flex items-center gap-1">
                                                        <EyeOff className="h-3.5 w-3.5" /> Hidden
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={item.openInNewTab}
                                                        onCheckedChange={(checked) =>
                                                            updateItem(section.id, item.id, (target) => ({
                                                                ...target,
                                                                openInNewTab: checked,
                                                            }))
                                                        }
                                                        disabled={isSaving}
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
                                                        disabled={isSaving}
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
                                                        disabled={isSaving}
                                                    >
                                                        <Plus className="h-4 w-4" /> Tambah Submenu
                                                    </Button>
                                                </div>

                                                {item.items.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">Belum ada submenu.</p>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {item.items.map((subItem, subIndex) => (
                                                            <div key={subItem.id} className="space-y-2 rounded-md border p-2">
                                                                <div className="flex items-center justify-end gap-1">
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
                                                                        disabled={subIndex === 0 || isSaving}
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
                                                                        disabled={subIndex === item.items.length - 1 || isSaving}
                                                                    >
                                                                        <ArrowDown className="h-4 w-4" />
                                                                    </Button>
                                                                </div>

                                                                <div className="grid gap-2 md:grid-cols-2">
                                                                    <Input
                                                                        value={subItem.title}
                                                                        onChange={(event) =>
                                                                            updateSubItem(section.id, item.id, subItem.id, (target) => ({
                                                                                ...target,
                                                                                title: event.target.value,
                                                                            }))
                                                                        }
                                                                        disabled={isSaving}
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
                                                                        disabled={isSaving}
                                                                        placeholder="URL Submenu"
                                                                    />
                                                                </div>

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
                                                                            disabled={isSaving}
                                                                        />
                                                                        <span>Hidden</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Switch
                                                                            checked={subItem.openInNewTab}
                                                                            onCheckedChange={(checked) =>
                                                                                updateSubItem(section.id, item.id, subItem.id, (target) => ({
                                                                                    ...target,
                                                                                    openInNewTab: checked,
                                                                                }))
                                                                            }
                                                                            disabled={isSaving}
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
                                                                            disabled={isSaving}
                                                                        />
                                                                        <span>Custom Link</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <Button onClick={onSave} disabled={isSaving} className="gap-2">
                    <Save className="h-4 w-4" />
                    {isSaving ? "Saving..." : "Simpan Pengaturan Menu"}
                </Button>
            </CardContent>
        </Card>
    )
}
