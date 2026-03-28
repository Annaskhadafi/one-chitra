"use client"

import { useState, useTransition } from "react"
import { trainHelpDeskFromPage } from "@/app/actions/helpdesk-ai"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function HelpDeskTrainingForm() {
    const [isPending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [form, setForm] = useState({
        slug: "",
        title: "",
        pagePath: "",
        summary: "",
        tags: "",
        content: "",
    })

    const submit = () => {
        setMessage(null)
        setError(null)

        startTransition(async () => {
            try {
                await trainHelpDeskFromPage(form)
                setMessage("Training berhasil disimpan. Chitra Jenius sudah belajar konteks terbaru.")
                setForm({ slug: "", title: "", pagePath: "", summary: "", tags: "", content: "" })
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal menyimpan training")
            }
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tambah Konteks Halaman</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="slug">Slug</Label>
                        <Input id="slug" placeholder="contoh: modul-approval" value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="title">Judul</Label>
                        <Input id="title" placeholder="Modul Approval Workflow" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="pagePath">Path Halaman</Label>
                        <Input id="pagePath" placeholder="/dashboard/approval-workflows" value={form.pagePath} onChange={(e) => setForm((prev) => ({ ...prev, pagePath: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="tags">Tags (pisahkan koma)</Label>
                        <Input id="tags" placeholder="approval,workflow,persetujuan" value={form.tags} onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))} />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="summary">Ringkasan</Label>
                    <Input id="summary" placeholder="Deskripsi singkat fungsi halaman" value={form.summary} onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))} />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="content">Konten Training</Label>
                    <Textarea
                        id="content"
                        rows={8}
                        placeholder="Jelaskan fitur, alur bisnis, relasi data, dan contoh penggunaan halaman ini."
                        value={form.content}
                        onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                    />
                </div>

                {message && <p className="text-sm text-emerald-600">{message}</p>}
                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button onClick={submit} disabled={isPending}>
                    {isPending ? "Menyimpan..." : "Simpan Training"}
                </Button>
            </CardContent>
        </Card>
    )
}
