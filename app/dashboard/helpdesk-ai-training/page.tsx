import { getHelpDeskTrainingData } from "@/app/actions/helpdesk-ai"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { HelpDeskTrainingForm } from "./_components/helpdesk-training-form"

export default async function HelpDeskAiTrainingPage() {
    const sources = await getHelpDeskTrainingData()

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Training MAGIC Help Desk</h1>
                <p className="text-sm text-muted-foreground">
                    Tambahkan konteks halaman agar Chitra Jenius menjawab sesuai fitur One Chitra.
                </p>
            </div>

            <HelpDeskTrainingForm />

            <Card>
                <CardHeader>
                    <CardTitle>Knowledge Base Aktif</CardTitle>
                    <CardDescription>
                        Data di bawah ini akan dipakai sebagai konteks jawaban di chat help desk.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {sources.length === 0 && (
                        <p className="text-sm text-muted-foreground">Belum ada data training.</p>
                    )}
                    {sources.map((source) => (
                        <div key={source.id} className="rounded-lg border p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{source.title}</p>
                                {source.pagePath && <Badge variant="outline">{source.pagePath}</Badge>}
                            </div>
                            {source.summary && <p className="text-sm text-muted-foreground mt-1">{source.summary}</p>}
                            <p className="text-xs text-muted-foreground mt-2">
                                Slug: {source.slug} • Update: {new Date(source.updatedAt).toLocaleString("id-ID")}
                            </p>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}
