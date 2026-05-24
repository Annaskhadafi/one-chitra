import os
base = r"D:/[01] PROJECT/one-chitra"
path = os.path.join(base, "app/dashboard/customers/_components/customer-table.tsx")

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Add Badge import
old_badge = 'import { Search, Pencil, Trash2, Users, UserPlus, ChevronUp, ChevronDown } from "lucide-react"'
new_badge = 'import { Search, Pencil, Trash2, Users, UserPlus, ChevronUp, ChevronDown } from "lucide-react"\nimport { Badge } from "@/components/ui/badge"'

old_email_col = '''        {
            accessorKey: "email",
            header: "Email",
            cell: ({ row }) => <span className="text-sm">{row.original.email || "-"}</span>,
        },
        {
            accessorKey: "address1",'''

new_email_col = '''        {
            accessorKey: "email",
            header: "Email",
            cell: ({ row }) => <span className="text-sm">{row.original.email || "-"}</span>,
        },
        {
            accessorKey: "businessCategory",
            header: "Kategori Bisnis",
            cell: ({ row }) => {
                const cat = row.original.businessCategory
                if (!cat) return <span className="text-muted-foreground text-xs italic">-</span>
                const COLORS: Record<string, string> = {
                    "Mining Contractor": "#f59e0b", "Mining Owner": "#d97706",
                    "Perkebunan": "#10b981", "Konstruksi": "#3b82f6",
                    "Minyak dan Gas": "#8b5cf6", "Kehutanan": "#059669",
                    "Transportasi dan Logistik": "#06b6d4", "Pemerintah": "#ec4899",
                    "Manufaktur": "#f97316", "Perdagangan": "#64748b",
                    "Quarry": "#a16207", "Agribisnis": "#16a34a", "Lainnya": "#94a3b8",
                }
                const color = COLORS[cat] || "#94a3b8"
                return (
                    <Badge variant="outline" className="text-xs font-medium whitespace-nowrap"
                        style={{ backgroundColor: color + "22", color, borderColor: color + "66" }}>
                        {cat}
                    </Badge>
                )
            },
        },
        {
            accessorKey: "address1",'''

ok = True
if old_badge not in content:
    print("ERROR: badge import pattern not found"); ok = False
if old_email_col not in content:
    print("ERROR: email column pattern not found"); ok = False

if ok:
    content = content.replace(old_badge, new_badge)
    content = content.replace(old_email_col, new_email_col)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("patched customer-table.tsx")
