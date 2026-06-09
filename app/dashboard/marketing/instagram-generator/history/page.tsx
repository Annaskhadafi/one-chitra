﻿﻿﻿﻿﻿﻿﻿"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Download, Trash2, Eye, Clock, ImageIcon, ArrowLeft, Trash } from "lucide-react"
import { toast } from "sonner"
import { getInstagramHistory, deleteInstagramHistory, clearInstagramHistory, incrementDownloadCount } from "@/app/actions/instagram-history"

type HistoryItem = {
  id: string
  userId: string
  prompt: string
  enhancedPrompt: string | null
  format: string
  contentType: string
  visualStyle: string
  width: number
  height: number
  mimeType: string
  sizeBytes: number | null
  imageUrl: string
  createdAt: Date
  downloadCount: number
}

export default function InstagramHistoryPage() {
  const [history, setHistory] = React.useState<HistoryItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [previewImage, setPreviewImage] = React.useState<HistoryItem | null>(null)

  const loadHistory = React.useCallback(async () => {
    try {
      setLoading(true)
      const data = await getInstagramHistory()
      setHistory(data as HistoryItem[])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat riwayat")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const handleDownload = async (item: HistoryItem) => {
    try {
      const link = document.createElement("a")
      link.href = item.imageUrl
      link.download = `instagram-${item.format}-${item.id}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      await incrementDownloadCount(item.id)
      setHistory(prev => prev.map(h => h.id === item.id ? { ...h, downloadCount: h.downloadCount + 1 } : h))
      toast.success("Gambar berhasil diunduh")
    } catch (err) {
      toast.error("Gagal mengunduh gambar")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteInstagramHistory(id)
      setHistory(prev => prev.filter(h => h.id !== id))
      toast.success("Riwayat berhasil dihapus")
    } catch (err) {
      toast.error("Gagal menghapus riwayat")
    }
  }

  const handleClearAll = async () => {
    try {
      await clearInstagramHistory()
      setHistory([])
      toast.success("Semua riwayat berhasil dihapus")
    } catch (err) {
      toast.error("Gagal menghapus semua riwayat")
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date))
  }

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "N/A"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/dashboard/marketing/instagram-generator">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold">Riwayat Gambar Instagram</h1>
          <p className="text-muted-foreground">
            {history.length} gambar tersimpan (maksimal 50)
          </p>
        </div>
        {history.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash className="w-4 h-4 mr-2" />
                Hapus Semua
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus Semua Riwayat</AlertDialogTitle>
                <AlertDialogDescription>
                  Apakah Anda yakin ingin menghapus semua riwayat gambar? Tindakan ini tidak dapat dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground">
                  Hapus Semua
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-square bg-muted animate-pulse" />
              <CardContent className="p-4 space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded" />
                <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : history.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ImageIcon className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Belum Ada Riwayat</h3>
            <p className="text-muted-foreground mb-4">
              Gambar yang Anda buat akan tersimpan di sini secara otomatis
            </p>
            <Link href="/dashboard/marketing/instagram-generator">
              <Button>
                Buat Gambar Baru
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {history.map(item => (
            <Card key={item.id} className="overflow-hidden group">
              <div className="relative aspect-square bg-muted">
                <Image
                  src={item.imageUrl}
                  alt={item.prompt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setPreviewImage(item)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDownload(item)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Unduh
                  </Button>
                </div>
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2 mb-1">
                      {item.prompt}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {item.format}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {item.contentType}
                      </Badge>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Riwayat</AlertDialogTitle>
                        <AlertDialogDescription>
                          Apakah Anda yakin ingin menghapus gambar ini dari riwayat?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground">
                          Hapus
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(item.createdAt)}
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{item.width}×{item.height}</span>
                    <span>{formatSize(item.sizeBytes)}</span>
                    <span>{item.downloadCount}× unduh</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Gambar</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="space-y-4">
              <div className="relative w-full bg-muted rounded-lg overflow-hidden">
                <Image
                  src={previewImage.imageUrl}
                  alt={previewImage.prompt}
                  width={previewImage.width}
                  height={previewImage.height}
                  className="w-full h-auto object-contain rounded-lg"
                  unoptimized
                />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge>{previewImage.format}</Badge>
                  <Badge variant="outline">{previewImage.contentType}</Badge>
                  <Badge variant="secondary">{previewImage.visualStyle}</Badge>
                </div>
                <p className="text-sm"><strong>Prompt:</strong> {previewImage.prompt}</p>
                {previewImage.enhancedPrompt && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Enhanced:</strong> {previewImage.enhancedPrompt}
                  </p>
                )}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-muted-foreground">
                    {previewImage.width}×{previewImage.height} • {formatSize(previewImage.sizeBytes)}
                  </span>
                  <Button onClick={() => handleDownload(previewImage)}>
                    <Download className="w-4 h-4 mr-2" />
                    Unduh Gambar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
