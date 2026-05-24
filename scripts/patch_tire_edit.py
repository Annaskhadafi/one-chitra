import os
base = r"D:/[01] PROJECT/one-chitra"
path = os.path.join(base, "app/dashboard/marketing/customer-tire-history/_components/customer-tire-history-client.tsx")

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add Pencil icon and useMutation imports
old_icons = '''    Search, RefreshCw, Download, ChevronDown, ChevronRight,
    TrendingUp, Users, DollarSign, Package, Building2, Layers
} from "lucide-react"'''
new_icons = '''    Search, RefreshCw, Download, ChevronDown, ChevronRight,
    TrendingUp, Users, DollarSign, Package, Building2, Layers, Pencil, Check, X
} from "lucide-react"'''

old_query_import = '''import { useQuery } from "@tanstack/react-query"'''
new_query_import = '''import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { updateCustomerBusinessCategory } from "@/app/actions/customer-industry"'''

# 2. Replace CustomerRow with edit-capable version
old_row = '''function CustomerRow({ customer }: { customer: TireHistoryCustomer }) {
    const [open, setOpen] = useState(false)
    const bizColor = BIZ_COLORS[customer.businessCategory || ""] || "#94a3b8"
    const sortedGroups = Object.entries(customer.matGroups).sort((a, b) => b[1].revenue - a[1].revenue)

    return (
        <>
            <TableRow
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => setOpen(o => !o)}
            >
                <TableCell className="w-8 pr-0">
                    {open
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </TableCell>
                <TableCell>
                    <div className="font-medium text-sm">{customer.customerName}</div>
                    {customer.businessCategory && (
                        <Badge variant="outline" className="text-[10px] mt-0.5 px-1.5 py-0"
                            style={{ backgroundColor: bizColor + "20", color: bizColor, borderColor: bizColor + "50" }}>
                            {customer.businessCategory}
                        </Badge>
                    )}
                </TableCell>'''

new_row = '''const INDUSTRY_OPTIONS = [
    "Mining Contractor","Mining Owner","Perkebunan","Konstruksi","Minyak dan Gas",
    "Kehutanan","Transportasi dan Logistik","Pemerintah","Manufaktur","Perdagangan",
    "Quarry","Agribisnis","Lainnya",
    "Kontraktor Tambang / Mining Services","Pertambangan & Energi",
    "Perkebunan, Agribisnis & Kehutanan","Konstruksi, Beton, Semen & Infrastruktur",
    "Oil, Gas & Drilling Services","Transportasi, Logistik & Pelabuhan",
    "Manufaktur & Industri","Alat Berat, Sparepart & Maintenance",
    "Perdagangan / Supplier Umum","Ban, Otomotif & Vulkanisir",
    "Instansi, Koperasi, Yayasan & Pendidikan","Jasa Profesional & Penunjang Usaha",
    "Power, Listrik & Utilitas","Perorangan / One Time Customer / Export",
]

function CustomerRow({ customer, onCategoryUpdated }: { customer: TireHistoryCustomer; onCategoryUpdated: () => void }) {
    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState(false)
    const [editValue, setEditValue] = useState(customer.businessCategory || "")
    const bizColor = BIZ_COLORS[customer.businessCategory || ""] || "#94a3b8"
    const sortedGroups = Object.entries(customer.matGroups).sort((a, b) => b[1].revenue - a[1].revenue)

    const saveMutation = useMutation({
        mutationFn: async (category: string) => {
            if (!customer.customerId) throw new Error("No customer ID")
            return updateCustomerBusinessCategory(customer.customerId, category)
        },
        onSuccess: () => {
            toast.success("Kategori berhasil diperbarui")
            setEditing(false)
            onCategoryUpdated()
        },
        onError: () => toast.error("Gagal menyimpan kategori"),
    })

    return (
        <>
            <TableRow className="hover:bg-muted/40">
                <TableCell className="w-8 pr-0 cursor-pointer" onClick={() => setOpen(o => !o)}>
                    {open
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </TableCell>
                <TableCell className="cursor-pointer" onClick={() => setOpen(o => !o)}>
                    <div className="font-medium text-sm">{customer.customerName}</div>
                    {editing ? (
                        <div className="flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
                            <Select value={editValue} onValueChange={setEditValue}>
                                <SelectTrigger className="h-6 text-xs w-[200px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {INDUSTRY_OPTIONS.map(opt => <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveMutation.mutate(editValue)} disabled={saveMutation.isPending}>
                                <Check className="h-3 w-3 text-emerald-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(false)}>
                                <X className="h-3 w-3 text-destructive" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 mt-0.5">
                            {customer.businessCategory ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0"
                                    style={{ backgroundColor: bizColor + "20", color: bizColor, borderColor: bizColor + "50" }}>
                                    {customer.businessCategory}
                                </Badge>
                            ) : (
                                <span className="text-[10px] text-muted-foreground italic">Belum dikategorikan</span>
                            )}
                            {customer.customerId && (
                                <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:opacity-100"
                                    onClick={e => { e.stopPropagation(); setEditing(true); setEditValue(customer.businessCategory || "") }}>
                                    <Pencil className="h-2.5 w-2.5" />
                                </Button>
                            )}
                        </div>
                    )}
                </TableCell>'''

ok = True
for old, new, label in [(old_icons, new_icons, "icons"), (old_query_import, new_query_import, "query_import"), (old_row, new_row, "row")]:
    if old in content:
        content = content.replace(old, new)
        print(f"patched {label}")
    else:
        print(f"ERROR: {label} pattern not found")
        ok = False

# 3. Fix CustomerRow usage to pass onCategoryUpdated
old_usage = '''                                        <CustomerRow key={customer.customerName} customer={customer} />'''
new_usage = '''                                        <CustomerRow key={customer.customerName} customer={customer} onCategoryUpdated={() => refetch()} />'''
if old_usage in content:
    content = content.replace(old_usage, new_usage)
    print("patched usage")
else:
    print("ERROR: usage pattern not found")

# 4. Add group class to TableRow for hover pencil visibility
old_tr = '''            <TableRow className="hover:bg-muted/40">'''
new_tr = '''            <TableRow className="hover:bg-muted/40 group">'''
if old_tr in content:
    content = content.replace(old_tr, new_tr)
    print("patched group class")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("saved")
