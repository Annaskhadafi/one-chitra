"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle, XCircle, DollarSign } from "lucide-react";

interface Stats {
    totalDocument: number;
    totalPengajuan: number;
    totalDisetujui: number;
    totalDitolak: number;
    totalRupiah: number;
}

export function DeliveryCostScorecard({ stats }: { stats: Stats }) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Dokumen</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalDocument}</div>
                    <p className="text-xs text-muted-foreground">
                        Dokumen Permintaan
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-amber-600">Proses Pengajuan</CardTitle>
                    <FileText className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalPengajuan}</div>
                    <p className="text-xs text-muted-foreground">
                        Menunggu Persetujuan
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-emerald-600">Disetujui</CardTitle>
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalDisetujui}</div>
                    <p className="text-xs text-muted-foreground">
                        Sudah disetujui / diproses
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Nominal Request</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        Rp {stats.totalRupiah.toLocaleString("id-ID")}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Total yang Disetujui/Pengajuan
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
