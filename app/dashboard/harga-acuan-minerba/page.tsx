import Link from "next/link"
import { ExternalLink, ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const MINERBA_URL = "https://www.minerba.esdm.go.id/harga_acuan"

export const metadata = {
    title: "Harga Acuan Minerba - One Chitra",
}

export default function HargaAcuanMinerbaPage() {
    return (
        <div className="p-6">
            <Card className="mx-auto max-w-3xl">
                <CardHeader className="text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <CardTitle>Data Harga Acuan Minerba</CardTitle>
                    <CardDescription>
                        Untuk alasan keamanan, data ini harus dibuka langsung melalui situs resmi ESDM.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-center">
                    <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
                        Situs tujuan menolak ditampilkan di dalam iframe browser, sehingga pesan
                        <span className="font-medium text-foreground"> Refused to connect </span>
                        tidak bisa dibypass dari sisi aplikasi.
                    </div>

                    <div>
                        <Button asChild size="lg" className="gap-2">
                            <Link href={MINERBA_URL} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                                Buka Harga Acuan
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
