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
        <Card className="group relative overflow-hidden transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] border-none bg-card/40 backdrop-blur-md hover:-translate-y-2 rounded-3xl">
            {/* Glow effect on hover */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-3xl -z-10"
                style={{ backgroundColor: item.color }}
            />

            {/* Top accent bar */}
            <div
                className="h-1.5 w-full bg-gradient-to-r from-transparent via-current to-transparent opacity-50"
                style={{ color: item.color }}
            />

            <CardContent className="pt-8">
                <div className="flex justify-between items-start mb-6">
                    <div
                        className="p-4 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
                        style={{ backgroundColor: item.color, boxShadow: `0 10px 20px ${item.color}33` }}
                    >
                        <IconComponent size={28} />
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/50 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                            {item.category}
                        </span>

                        {isAdmin && mounted && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-white/10 transition-colors">
                                        <MoreVertical size={18} />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-2xl border-white/10 bg-card/80 backdrop-blur-xl">
                                    <DropdownMenuItem onClick={() => onEdit?.(item)} className="rounded-xl">
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-destructive rounded-xl"
                                        onClick={() => onDelete?.(item.id)}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        {isAdmin && !mounted && (
                            <Button variant="ghost" size="icon" className="h-9 w-9 disabled:opacity-0" disabled>
                                <MoreVertical size={18} />
                            </Button>
                        )}
                    </div>
                </div>

                <h3 className="font-extrabold text-xl mb-2 truncate group-hover:text-primary transition-colors">{item.name}</h3>
                <p className="text-sm text-muted-foreground/80 line-clamp-2 min-h-[40px] leading-relaxed">
                    {item.description || "Silakan pilih sistem yang ingin diakses."}
                </p>
            </CardContent>

            <CardFooter className="pb-8">
                <Button
                    className="w-full h-12 rounded-2xl text-white font-bold flex items-center justify-center gap-2 transition-all duration-300 hover:brightness-110 shadow-lg active:scale-95 border-none"
                    style={{ backgroundColor: item.color, boxShadow: `0 8px 15px ${item.color}44` }}
                    onClick={() => {
                        if (item.newTab) {
                            window.open(item.url, "_blank")
                        } else {
                            window.location.href = item.url
                        }
                    }}
                >
                    LAUNCH SYSTEM
                    <ExternalLink size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Button>
            </CardFooter>
        </Card>
    )
}
