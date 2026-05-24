"use client"

import * as React from "react"
import { ScannerDrawer } from "@/components/business-card/scanner-drawer"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Mail, Phone, MapPin, ScanLine, UserSquare2, ChevronRight, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Image from "next/image"

type BusinessCard = {
    id: number
    name: string
    company: string | null
    jobTitle: string | null
    phone: string | null
    email: string | null
    address: string | null
    businessCategory: string | null
    imageUrl: string | null
    createdAt: Date
}

export function ClientBusinessCardDashboard({ initialCards }: { initialCards: BusinessCard[] }) {
    const [selectedCategory, setSelectedCategory] = React.useState<string>("All")
    const [selectedCard, setSelectedCard] = React.useState<BusinessCard | null>(null)

    // Extract unique categories, ignoring nulls
    const categories = React.useMemo(() => {
        const cats = new Set<string>()
        initialCards.forEach(card => {
            if (card.businessCategory) cats.add(card.businessCategory)
        })
        return ["All", ...Array.from(cats)]
    }, [initialCards])

    const filteredCards = React.useMemo(() => {
        if (selectedCategory === "All") return initialCards
        return initialCards.filter(c => c.businessCategory === selectedCategory)
    }, [initialCards, selectedCategory])

    return (
        <div className="min-h-screen bg-muted/30 pb-24 relative max-w-md mx-auto sm:max-w-full sm:px-6 shadow-sm border-x">
            {/* Header Dashboard */}
            <div className="bg-primary px-6 pt-12 pb-8 rounded-b-3xl text-primary-foreground shadow-lg mb-6">
                <h1 className="text-2xl font-bold mb-1">My Business Cards</h1>
                <p className="text-primary-foreground/80 text-sm mb-6">Kelola dan temukan relasi bisnis Anda</p>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-primary-foreground/10 rounded-2xl p-4 backdrop-blur-sm border border-primary-foreground/20">
                        <div className="text-3xl font-bold">{initialCards.length}</div>
                        <div className="text-xs text-primary-foreground/70 font-medium uppercase tracking-wider">Total Kartu</div>
                    </div>
                    <div className="bg-primary-foreground/10 rounded-2xl p-4 backdrop-blur-sm border border-primary-foreground/20">
                        <div className="text-3xl font-bold">{categories.length - 1}</div>
                        <div className="text-xs text-primary-foreground/70 font-medium uppercase tracking-wider">Kategori</div>
                    </div>
                </div>
            </div>

            {/* Category Chips - Scrollable Horizontally */}
            <div className="px-4 mb-6">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`snap-start whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-all ${
                                selectedCategory === cat 
                                ? "bg-primary text-primary-foreground shadow-md scale-105" 
                                : "bg-background border text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Card List */}
            <div className="px-4 space-y-4">
                {filteredCards.length === 0 ? (
                    <div className="text-center py-12 px-4 bg-background rounded-3xl border border-dashed border-muted-foreground/30">
                        <UserSquare2 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-foreground">Belum ada kartu</h3>
                        <p className="text-sm text-muted-foreground mt-1">Scan kartu nama pertama Anda dengan tombol di bawah.</p>
                    </div>
                ) : (
                    filteredCards.map((card) => (
                        <Card 
                            key={card.id} 
                            className="overflow-hidden border-none shadow-sm rounded-2xl bg-background hover:shadow-md transition-shadow cursor-pointer group"
                            onClick={() => setSelectedCard(card)}
                        >
                            <CardContent className="p-0 flex h-28">
                                {/* Thumbnail */}
                                <div className="w-24 h-full bg-muted relative shrink-0">
                                    {card.imageUrl ? (
                                        <Image src={card.imageUrl} alt={card.name} fill className="object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-primary/5">
                                            <UserSquare2 className="w-8 h-8 text-primary/40" />
                                        </div>
                                    )}
                                </div>
                                
                                {/* Info */}
                                <div className="p-4 flex-1 flex flex-col justify-center min-w-0">
                                    <h3 className="font-semibold text-base truncate pr-6">{card.name}</h3>
                                    {card.company && (
                                        <p className="text-sm text-muted-foreground truncate">{card.company}</p>
                                    )}
                                    <div className="mt-auto pt-2 flex items-center justify-between">
                                        <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary">
                                            {card.businessCategory || "General"}
                                        </Badge>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* FAB Scanner Button */}
            <ScannerDrawer>
                <Button 
                    size="icon" 
                    className="fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] shadow-primary/40 hover:scale-105 transition-transform z-50 sm:right-10 sm:bottom-10"
                >
                    <ScanLine className="w-7 h-7" />
                </Button>
            </ScannerDrawer>

            {/* Detail Dialog */}
            <Dialog open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCard(null)}>
                <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl bg-background">
                    {selectedCard && (
                        <div className="flex flex-col max-h-[85vh]">
                            <div className="w-full aspect-video bg-muted relative">
                                {selectedCard.imageUrl ? (
                                    <Image src={selectedCard.imageUrl} alt={selectedCard.name} fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-primary/5">
                                        <UserSquare2 className="w-16 h-16 text-primary/20" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6 text-white">
                                    <Badge className="w-fit mb-2 bg-primary hover:bg-primary/90 text-primary-foreground border-none">
                                        {selectedCard.businessCategory || "General"}
                                    </Badge>
                                    <h2 className="text-2xl font-bold">{selectedCard.name}</h2>
                                    <p className="text-white/80 font-medium">{selectedCard.jobTitle}</p>
                                </div>
                            </div>
                            
                            <div className="p-6 space-y-6 overflow-y-auto">
                                <div className="space-y-4">
                                    {selectedCard.company && (
                                        <div className="flex gap-4 items-start">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <Building2 className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-muted-foreground">Perusahaan</p>
                                                <p className="text-base">{selectedCard.company}</p>
                                            </div>
                                        </div>
                                    )}
                                    {selectedCard.phone && (
                                        <div className="flex gap-4 items-start">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <Phone className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-muted-foreground">Telepon</p>
                                                <p className="text-base">{selectedCard.phone}</p>
                                            </div>
                                        </div>
                                    )}
                                    {selectedCard.email && (
                                        <div className="flex gap-4 items-start">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <Mail className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-muted-foreground">Email</p>
                                                <p className="text-base break-all">{selectedCard.email}</p>
                                            </div>
                                        </div>
                                    )}
                                    {selectedCard.address && (
                                        <div className="flex gap-4 items-start">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <MapPin className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-muted-foreground">Alamat</p>
                                                <p className="text-base leading-snug">{selectedCard.address}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
