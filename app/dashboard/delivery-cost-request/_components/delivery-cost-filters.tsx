"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, FilterX } from "lucide-react";
import { Input } from "@/components/ui/input";

export function DeliveryCostFilters() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Local state for immediate typing/selection
    const [from, setFrom] = useState(searchParams.get("from") || "");
    const [to, setTo] = useState(searchParams.get("to") || "");
    const [status, setStatus] = useState(searchParams.get("status") || "Semua");

    const applyFilters = useCallback((newFrom: string, newTo: string, newStatus: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (newFrom) params.set("from", newFrom); else params.delete("from");
        if (newTo) params.set("to", newTo); else params.delete("to");
        if (newStatus && newStatus !== "Semua") params.set("status", newStatus); else params.delete("status");

        router.push(pathname + "?" + params.toString());
    }, [pathname, router, searchParams]);

    const handleApply = () => {
        applyFilters(from, to, status);
    };

    const handleClear = () => {
        setFrom("");
        setTo("");
        setStatus("Semua");
        router.push(pathname);
    };

    const setQuickDate = (type: "thisMonth" | "thisWeek" | "thisYear" | "lastWeek" | "lastMonth") => {
        const now = new Date();
        let newFrom = new Date();
        let newTo = new Date();

        if (type === "thisMonth") {
            newFrom = new Date(now.getFullYear(), now.getMonth(), 1);
            newTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (type === "thisWeek") {
            const first = now.getDate() - now.getDay() + 1; // Monday
            newFrom = new Date(now.getFullYear(), now.getMonth(), first);
            newTo = new Date(now.getFullYear(), now.getMonth(), first + 6);
        } else if (type === "thisYear") {
            newFrom = new Date(now.getFullYear(), 0, 1);
            newTo = new Date(now.getFullYear(), 11, 31);
        } else if (type === "lastWeek") {
            const first = now.getDate() - now.getDay() + 1 - 7;
            newFrom = new Date(now.getFullYear(), now.getMonth(), first);
            newTo = new Date(now.getFullYear(), now.getMonth(), first + 6);
        } else if (type === "lastMonth") {
            newFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            newTo = new Date(now.getFullYear(), now.getMonth(), 0);
        }

        // Format to YYYY-MM-DD local time offset safely
        const offset = newFrom.getTimezoneOffset() * 60000;
        const fromStr = new Date(newFrom.getTime() - offset).toISOString().split('T')[0];
        const toStr = new Date(newTo.getTime() - offset).toISOString().split('T')[0];

        setFrom(fromStr);
        setTo(toStr);
        applyFilters(fromStr, toStr, status);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
                <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Tanggal Dari</label>
                    <Input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className="w-[150px] h-9"
                    />
                </div>
                <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground">Sampai</label>
                    <Input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="w-[150px] h-9"
                    />
                </div>
                <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground">Status</label>
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="w-[150px] h-9">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Semua">Semua Status</SelectItem>
                            <SelectItem value="Pengajuan">Pengajuan</SelectItem>
                            <SelectItem value="Disetujui">Disetujui</SelectItem>
                            <SelectItem value="Ditolak">Ditolak</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex gap-2">
                    <Button onClick={handleApply} size="sm" className="h-9">Terapkan</Button>
                    <Button variant="outline" size="icon" className="h-9" title="Reset Filters" onClick={handleClear}>
                        <FilterX className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setQuickDate("thisWeek")}>Minggu Ini</Button>
                <Button variant="secondary" size="sm" onClick={() => setQuickDate("lastWeek")}>Minggu Lalu</Button>
                <Button variant="secondary" size="sm" onClick={() => setQuickDate("thisMonth")}>Bulan Ini</Button>
                <Button variant="secondary" size="sm" onClick={() => setQuickDate("lastMonth")}>Bulan Lalu</Button>
                <Button variant="secondary" size="sm" onClick={() => setQuickDate("thisYear")}>Tahun Ini</Button>
            </div>
        </div>
    );
}
