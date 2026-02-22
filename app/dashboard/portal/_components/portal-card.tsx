"use client"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, MoreVertical, Pencil, Trash2 } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import * as LucideIcons from "lucide-react"
import { type portalItems } from "@/db/schema"
import { cn } from "@/lib/utils"
import { useMounted } from "@/hooks/use-mounted"

interface PortalCardProps {
    item: typeof portalItems.$inferSelect
    isAdmin?: boolean
    onEdit?: (item: typeof portalItems.$inferSelect) => void
    onDelete?: (id: string) => void
}

export function PortalCard({ item, isAdmin, onEdit, onDelete }: PortalCardProps) {
    const mounted = useMounted()
    // Dynamically get Lucide icon
    const IconComponent = (LucideIcons as any)[item.icon] || LucideIcons.Globe

    return (
        <Card className="group relative overflow-hidden transition-all hover:shadow-lg border-none bg-card/50 backdrop-blur-sm">
            {/* Top accent bar */}
            <div
                className="h-1.5 w-full"
                style={{ backgroundColor: item.color }}
            />

            <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                    <div
                        className="p-3 rounded-xl flex items-center justify-center text-white"
                        style={{ backgroundColor: item.color }}
                    >
                        <IconComponent size={24} />
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {item.category}
                        </span>

                        {isAdmin && mounted && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical size={16} />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => onEdit?.(item)}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => onDelete?.(item.id)}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        {isAdmin && !mounted && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 disabled:opacity-0" disabled>
                                <MoreVertical size={16} />
                            </Button>
                        )}
                    </div>
                </div>

                <h3 className="font-bold text-lg mb-1 truncate">{item.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                    {item.description || "Silakan pilih sistem yang ingin diakses."}
                </p>
            </CardContent>

            <CardFooter className="pb-6">
                <Button
                    className="w-full text-white font-semibold flex items-center gap-2 transition-all hover:brightness-110"
                    style={{ backgroundColor: item.color }}
                    onClick={() => {
                        if (item.newTab) {
                            window.open(item.url, "_blank")
                        } else {
                            window.location.href = item.url
                        }
                    }}
                >
                    LAUNCH
                    <ExternalLink size={14} />
                </Button>
            </CardFooter>
        </Card>
    )
}
