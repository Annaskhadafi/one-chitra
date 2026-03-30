import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Database, FileText, RefreshCcw } from "lucide-react";

const VIEW_ID = "2354";
const VIEW_URL = `https://proc-share.com/wp-json/gravityview/v1/views/${VIEW_ID}`;
const ENTRIES_URL = `https://proc-share.com/wp-json/gravityview/v1/views/${VIEW_ID}/entries.json?limit=0`;

const COLUMN_ORDER = [
    "18",
    "1",
    "49",
    "50",
    "7",
    "30",
    "47",
    "44",
    "16",
    "27",
    "22",
    "23",
    "38",
    "40",
    "41",
    "51",
] as const;

type ColumnId = (typeof COLUMN_ORDER)[number];

type ViewColumn = {
    id: string;
    label: string;
};

type ViewPayload = {
    fields?: {
        "directory_table-columns"?: Record<string, ViewColumn>;
    };
};

type EntryRecord = Partial<Record<ColumnId, string | string[]>>;

type EntriesPayload = {
    entries?: EntryRecord[];
    total?: number;
};

async function fetchJsonWithNestedString<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        cache: "no-store",
        headers: {
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    const text = await response.text();
    const parsed = JSON.parse(text) as T | string;
    return (typeof parsed === "string" ? JSON.parse(parsed) : parsed) as T;
}

function formatDate(value: string | null | undefined) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
}

function formatCurrency(value: string | null | undefined) {
    if (!value) return "—";

    const amount = Number(value);
    if (!Number.isFinite(amount)) return value;

    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatStatusTone(status: string) {
    const normalized = status.trim().toLowerCase();

    if (normalized === "completed") {
        return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
    }

    if (normalized === "submited" || normalized === "submitted") {
        return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
    }

    return "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300";
}

function renderFileLinks(value: string | string[]) {
    const urls = Array.isArray(value) ? value : [value];
    const filteredUrls = urls.filter(Boolean);

    if (filteredUrls.length === 0) {
        return <span className="text-muted-foreground/60">—</span>;
    }

    return (
        <div className="flex flex-col gap-1.5">
            {filteredUrls.map((url, index) => (
                <a
                    key={`${url}-${index}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span>Attachment {index + 1}</span>
                </a>
            ))}
        </div>
    );
}

function renderCellValue(columnId: ColumnId, value: string | string[] | undefined) {
    if (value == null || (typeof value === "string" && value.trim() === "")) {
        return <span className="text-muted-foreground/60">—</span>;
    }

    if (columnId === "22" || columnId === "23") {
        return renderFileLinks(value);
    }

    if (columnId === "1" || columnId === "40" || columnId === "47") {
        return <span>{formatDate(Array.isArray(value) ? value[0] : value)}</span>;
    }

    if (columnId === "27") {
        return <span className="font-medium">{formatCurrency(Array.isArray(value) ? value[0] : value)}</span>;
    }

    if (columnId === "41") {
        const status = Array.isArray(value) ? value[0] : value;
        return (
            <Badge variant="outline" className={formatStatusTone(status)}>
                {status}
            </Badge>
        );
    }

    if (Array.isArray(value)) {
        return <span>{value.join(", ")}</span>;
    }

    return <span>{value}</span>;
}

export default async function EprIntegrasiPage() {
    const [viewPayload, entriesPayload] = await Promise.all([
        fetchJsonWithNestedString<ViewPayload>(VIEW_URL),
        fetchJsonWithNestedString<EntriesPayload>(ENTRIES_URL),
    ]);

    const directoryColumns = viewPayload.fields?.["directory_table-columns"] ?? {};
    const columns = COLUMN_ORDER.map((columnId) => {
        const matchedColumn = Object.values(directoryColumns).find((column) => column.id === columnId);

        return {
            id: columnId,
            label: matchedColumn?.label ?? `Field ${columnId}`,
        };
    });

    const entries = entriesPayload.entries ?? [];
    const totalEntries = entriesPayload.total ?? entries.length;
    const completedCount = entries.filter((entry) => `${entry["41"] ?? ""}`.trim().toLowerCase() === "completed").length;
    const submittedCount = entries.filter((entry) => {
        const status = `${entry["41"] ?? ""}`.trim().toLowerCase();
        return status === "submited" || status === "submitted";
    }).length;

    return (
        <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">EPR Integrasi</h1>
                        <Badge variant="secondary" className="text-xs font-medium">
                            View ID {VIEW_ID}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        Menampilkan data EPR dari GravityView API Proc-Share dengan label field sesuai konfigurasi view.
                    </p>
                </div>
                <a
                    href={ENTRIES_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
                >
                    <RefreshCcw className="h-4 w-4" />
                    Buka Source API
                </a>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/40 dark:to-indigo-900/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            Total Data
                        </CardTitle>
                        <Database className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                        <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">{totalEntries}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Seluruh entry dari API view 2354</p>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Completed
                        </CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                        <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{completedCount}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Entry dengan status selesai</p>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            Submitted
                        </CardTitle>
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                        <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">{submittedCount}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Entry dengan status submited/submitted</p>
                    </CardContent>
                </Card>
            </div>

            <Separator />

            <Card className="shadow-sm border">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Data Table</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Header kolom mengikuti label dan ID field dari view GravityView.
                    </p>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                    {entries.length === 0 ? (
                        <div className="flex h-56 items-center justify-center px-6 text-sm text-muted-foreground">
                            Tidak ada data yang tersedia dari API.
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4 px-4 sm:hidden">
                                {entries.map((entry, index) => (
                                    <Card key={`${entry["18"] ?? "entry"}-${index}`} className="border bg-background shadow-none">
                                        <CardContent className="space-y-3 p-4">
                                            {columns.map((column) => (
                                                <div key={`${column.id}-${index}`} className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs font-semibold text-foreground">{column.label}</p>
                                                        <Badge variant="outline" className="text-[10px]">
                                                            ID {column.id}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-sm break-words">
                                                        {renderCellValue(column.id, entry[column.id])}
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <div className="hidden md:block">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                {columns.map((column) => (
                                                    <TableHead
                                                        key={column.id}
                                                        className="min-w-[180px] align-top text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                                                    >
                                                        <div className="space-y-1">
                                                            <p className="leading-tight">{column.label}</p>
                                                            <span className="text-[10px] font-medium normal-case text-muted-foreground/80">
                                                                ID: {column.id}
                                                            </span>
                                                        </div>
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {entries.map((entry, index) => (
                                                <TableRow key={`${entry["18"] ?? "entry"}-${index}`} className="align-top hover:bg-muted/40">
                                                    {columns.map((column) => (
                                                        <TableCell
                                                            key={`${column.id}-${index}`}
                                                            className="text-sm leading-relaxed"
                                                        >
                                                            {renderCellValue(column.id, entry[column.id])}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
