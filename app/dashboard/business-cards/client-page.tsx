"use client"

import * as React from "react"
import { ScannerDrawer } from "@/components/business-card/scanner-drawer"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Mail, Phone, MapPin, ScanLine, UserSquare2, ChevronRight, Edit2, Trash2, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import { updateBusinessCard, deleteBusinessCard } from "@/app/actions/business-card-scanner"
import { toast } from "sonner"

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
    const [isEditing, setIsEditing] = React.useState(false)
    const [editForm, setEditForm] = React.useState<Partial<BusinessCard>>({})
    const [isSaving, setIsSaving] = React.useState(false)

    const handleEdit = () => {
        setEditForm({ ...selectedCard })
        setIsEditing(true)
    }

    const handleSave = async () => {
        if (!selectedCard) return
        setIsSaving(true)
        try {
            const res = await updateBusinessCard(selectedCard.id, {
                name: editForm.name || "Unknown",
                company: editForm.company,
                jobTitle: editForm.jobTitle,
                phone: editForm.phone,
                email: editForm.email,
                address: editForm.address,
                businessCategory: editForm.businessCategory,
            })
            if (res.success) {
                toast.success("Kartu nama berhasil diperbarui")
                setIsEditing(false)
                setSelectedCard(prev => prev ? { ...prev, ...editForm } as BusinessCard : null)
                // Note: The parent page will revalidate and update initialCards in background
            } else {
                toast.error(res.error || "Gagal menyimpan")
            }
        } catch (e) {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!selectedCard) return
        if (!confirm("Anda yakin ingin menghapus kartu nama ini?")) return
        setIsSaving(true)
        try {
            const res = await deleteBusinessCard(selectedCard.id)
            if (res.success) {
                toast.success("Kartu nama berhasil dihapus")
                setSelectedCard(null)
                // Note: Will revalidate from server action
            } else {
                toast.error(res.error || "Gagal menghapus")
            }
        } catch (e) {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setIsSaving(false)
        }
    }

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
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] shadow-primary/40 hover:scale-105 transition-transform z-50"
                >
                    <ScanLine className="w-7 h-7" />
                </Button>
            </ScannerDrawer>

            {/* Detail Dialog */}
            <Dialog open={!!selectedCard} onOpenChange={(open) => {
                if (!open) {
                    setSelectedCard(null)
                    setIsEditing(false)
                }
            }}>
                <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl bg-background max-h-[90vh] flex flex-col">
                    {selectedCard && (
                        <>
                            <div className="w-full aspect-video bg-muted relative shrink-0">
                                {selectedCard.imageUrl ? (
                                    <Image src={selectedCard.imageUrl} alt={selectedCard.name} fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-primary/5">
                                        <UserSquare2 className="w-16 h-16 text-primary/20" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-6 text-white">
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            <Input 
                                                value={editForm.businessCategory || ""} 
                                                onChange={e => setEditForm(prev => ({ ...prev, businessCategory: e.target.value }))}
                                                className="h-7 text-xs bg-black/50 border-white/20 text-white placeholder:text-white/50 w-full mb-2"
                                                placeholder="Kategori Bisnis"
                                            />
                                            <Input 
                                                value={editForm.name || ""} 
                                                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                                className="h-10 text-xl font-bold bg-black/50 border-white/20 text-white placeholder:text-white/50 w-full"
                                                placeholder="Nama"
                                            />
                                            <Input 
                                                value={editForm.jobTitle || ""} 
                                                onChange={e => setEditForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                                                className="h-8 text-sm bg-black/50 border-white/20 text-white placeholder:text-white/50 w-full"
                                                placeholder="Jabatan"
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <Badge className="w-fit mb-2 bg-primary hover:bg-primary/90 text-primary-foreground border-none">
                                                {selectedCard.businessCategory || "General"}
                                            </Badge>
                                            <h2 className="text-2xl font-bold">{selectedCard.name}</h2>
                                            <p className="text-white/80 font-medium">{selectedCard.jobTitle}</p>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            <div className="p-6 space-y-6 overflow-y-auto flex-1">
                                <div className="space-y-4">
                                    {/* Company */}
                                    <div className="flex gap-4 items-start">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                                            <Building2 className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <Label className="text-xs text-muted-foreground">Perusahaan</Label>
                                            {isEditing ? (
                                                <Input 
                                                    value={editForm.company || ""} 
                                                    onChange={e => setEditForm(prev => ({ ...prev, company: e.target.value }))}
                                                    className="mt-1"
                                                />
                                            ) : (
                                                <p className="text-base">{selectedCard.company || "-"}</p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Phone */}
                                    <div className="flex gap-4 items-start">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                                            <Phone className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <Label className="text-xs text-muted-foreground">Telepon</Label>
                                            {isEditing ? (
                                                <Input 
                                                    value={editForm.phone || ""} 
                                                    onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                                                    className="mt-1"
                                                />
                                            ) : (
                                                <p className="text-base">{selectedCard.phone || "-"}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div className="flex gap-4 items-start">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                                            <Mail className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <Label className="text-xs text-muted-foreground">Email</Label>
                                            {isEditing ? (
                                                <Input 
                                                    value={editForm.email || ""} 
                                                    onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                                    className="mt-1"
                                                />
                                            ) : (
                                                <p className="text-base break-all">{selectedCard.email || "-"}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Address */}
                                    <div className="flex gap-4 items-start">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                                            <MapPin className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <Label className="text-xs text-muted-foreground">Alamat</Label>
                                            {isEditing ? (
                                                <Input 
                                                    value={editForm.address || ""} 
                                                    onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                                                    className="mt-1"
                                                />
                                            ) : (
                                                <p className="text-base leading-snug">{selectedCard.address || "-"}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-4 border-t bg-muted/10 shrink-0">
                                {isEditing ? (
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)} disabled={isSaving}>
                                            <X className="w-4 h-4 mr-2" /> Batal
                                        </Button>
                                        <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                                            <Save className="w-4 h-4 mr-2" /> Simpan
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20" onClick={handleDelete} disabled={isSaving}>
                                            <Trash2 className="w-4 h-4 mr-2" /> Hapus
                                        </Button>
                                        <Button className="flex-1" onClick={handleEdit}>
                                            <Edit2 className="w-4 h-4 mr-2" /> Edit Data
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
