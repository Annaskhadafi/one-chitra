"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Wand2, Check, Sparkles, Loader2 } from "lucide-react"
import { generateEmailHtml } from "@/app/actions/ollama"
import { toast } from "sonner"

interface MagicGeneratorProps {
  onApply: (html: string) => void
}

export function MagicGenerator({ onApply }: MagicGeneratorProps) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [generatedHtml, setGeneratedHtml] = useState("")
  const [history, setHistory] = useState<{ role: string; content: string }[]>([])

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error("Ketik sesuatu untuk mulai...")
    
    setLoading(true)
    try {
      const res = await generateEmailHtml(prompt, history)
      if (res.success && res.html) {
        setGeneratedHtml(res.html)
        setHistory(prev => [
          ...prev, 
          { role: "user", content: prompt }, 
          { role: "assistant", content: res.html }
        ])
        setPrompt("") // Clear for revision prompts
        onApply(res.html) // Auto-apply to main editor
      } else {
        toast.error(res.error || "Gagal menghasilkan email")
      }
    } catch (err: any) {
      toast.error("Terjadi kesalahan: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    onApply(generatedHtml)
    setOpen(false)
    toast.success("Konten diterapkan ke editor")
  }

  const handleReset = () => {
    setGeneratedHtml("")
    setHistory([])
    setPrompt("")
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
        setOpen(v)
        if (!v) handleReset()
    }}>
      <DialogTrigger asChild>
        <Button 
          type="button"
          variant="outline" 
          size="sm" 
          className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200 text-indigo-700 hover:from-indigo-100 hover:to-blue-100 shadow-sm transition-all hover:scale-105 active:scale-95"
        >
          <Wand2 className="mr-2 h-3.5 w-3.5" /> Magic Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[95vh] h-[800px] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <div className="p-2 bg-indigo-100 rounded-lg">
                <Sparkles className="h-5 w-5 text-indigo-600" />
            </div>
            Magic Draft Studio
          </DialogTitle>
          <p className="text-sm text-muted-foreground ml-11 -mt-1">
            Susun email HTML yang rapi dan profesional dalam hitungan detik.
          </p>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-0 flex-1 overflow-hidden">
          {/* Left: Prompt & Controls */}
          <div className="flex flex-col gap-5 p-6 border-r bg-slate-50/50">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                <span>Instruksi Anda</span>
                {generatedHtml && (
                    <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-600 font-normal uppercase tracking-wider">
                        Revisi Mode
                    </span>
                )}
              </label>
              <Textarea 
                placeholder={generatedHtml ? "Apa yang perlu diubah? (Contoh: 'Buat font lebih besar' atau 'Ubah warna header jadi merah')" : "Jelaskan email yang Anda inginkan (Contoh: 'Buat email penawaran spesial ban truck untuk PT Maju Jaya dengan diskon 15%')"}
                className="min-h-[180px] h-[300px] bg-white border-slate-200 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                        handleGenerate()
                    }
                }}
              />
              <p className="text-[10px] text-muted-foreground text-right italic">Tekan CTRL + ENTER untuk generate</p>
            </div>
            
            <Button 
              onClick={handleGenerate} 
              disabled={loading || !prompt.trim()}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all hover:shadow-lg shadow-indigo-200"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sedang Meracik...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-5 w-5" /> {generatedHtml ? "Revisi & Update" : "Generate Email Sekarang"}
                </>
              )}
            </Button>

            <div className="mt-auto space-y-4">
              <div className="p-4 bg-white border border-indigo-100 rounded-xl shadow-sm">
                <h4 className="text-xs font-bold text-indigo-700 mb-1 flex items-center gap-1.5">
                   💡 Tips Profesional
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed italic">
                  Sertakan detail seperti <span className="underline decoration-indigo-200">nama produk</span>, <span className="underline decoration-indigo-200">besaran promo</span>, dan <span className="underline decoration-indigo-200">target audiens</span> agar hasil lebih akurat dan personal.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="flex flex-col bg-white overflow-hidden relative">
            <div className="bg-white px-5 py-3 border-b flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                 <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                 </div>
                 <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2">Live Preview</span>
              </div>
              {loading && (
                <div className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                    <span className="text-[10px] text-indigo-500 font-medium">Generating...</span>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center items-start">
               <div className="w-full max-w-[600px] min-h-[500px] bg-white shadow-2xl rounded-lg overflow-hidden ring-1 ring-slate-200/50">
                    <iframe 
                        srcDoc={generatedHtml || `
                            <div style="height:500px; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:12px; color:#94a3b8; font-family:system-ui, -apple-system, sans-serif; padding:40px; text-align:center;">
                                <div style="width:48px; height:48px; background:#f1f5f9; border-radius:12px; display:flex; align-items:center; justify-content:center;">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                </div>
                                <div style="font-weight:600; color:#475569; font-size:16px;">Belum Ada Draft</div>
                                <div style="font-size:13px; max-width:240px; line-height:1.5; color:#64748b;">
                                    Tuliskan instruksi Anda di panel kiri dan klik "Generate" untuk melihat keajaiban terjadi.
                                </div>
                            </div>
                        `}
                        className="w-full h-[600px] border-none"
                        title="Magic Preview"
                    />
               </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 border-t bg-slate-50 gap-3">
          <Button 
            variant="outline" 
            type="button"
            onClick={() => {
                setOpen(false)
                handleReset()
            }}
            disabled={loading}
          >
            Batal
          </Button>
          <Button 
            type="button"
            onClick={handleApply} 
            disabled={!generatedHtml || loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 shadow-lg shadow-emerald-100"
          >
            <Check className="mr-2 h-4 w-4" /> Gunakan Draft Ini di Editor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
