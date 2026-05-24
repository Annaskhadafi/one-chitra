import os
base = r"D:/[01] PROJECT/one-chitra"
path = os.path.join(base, "app/dashboard/marketing/customer-tire-history/_components/customer-tire-history-client.tsx")

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add Popover + Command imports
old_select_import = '''import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"'''
new_select_import = '''import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { ChevronsUpDown } from "lucide-react"'''

# 2. Replace the inline Select in CustomerRow edit mode with searchable Combobox
old_select_edit = '''                        <div className="flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
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
                        </div>'''

new_select_edit = '''                        <div className="flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
                            <CategoryCombobox value={editValue} onChange={setEditValue} />
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveMutation.mutate(editValue)} disabled={saveMutation.isPending}>
                                <Check className="h-3 w-3 text-emerald-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(false)}>
                                <X className="h-3 w-3 text-destructive" />
                            </Button>
                        </div>'''

# 3. Add CategoryCombobox component before CustomerRow
old_customer_row_fn = '''function CustomerRow({ customer, onCategoryUpdated }: { customer: TireHistoryCustomer; onCategoryUpdated: () => void }) {'''
new_customer_row_fn = '''function CategoryCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false)
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open}
                    className="h-7 w-[220px] justify-between text-xs font-normal px-2">
                    <span className="truncate">{value || "Pilih kategori..."}</span>
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Cari kategori..." className="h-8 text-xs" />
                    <CommandList>
                        <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                            {INDUSTRY_OPTIONS.map(opt => (
                                <CommandItem key={opt} value={opt} onSelect={() => { onChange(opt); setOpen(false) }}
                                    className="text-xs cursor-pointer">
                                    <Check className={"mr-2 h-3 w-3 " + (value === opt ? "opacity-100" : "opacity-0")} />
                                    {opt}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

function CustomerRow({ customer, onCategoryUpdated }: { customer: TireHistoryCustomer; onCategoryUpdated: () => void }) {'''

ok = True
for old, new, label in [
    (old_select_import, new_select_import, "imports"),
    (old_select_edit, new_select_edit, "select_edit"),
    (old_customer_row_fn, new_customer_row_fn, "combobox_component"),
]:
    if old in content:
        content = content.replace(old, new)
        print(f"patched {label}")
    else:
        print(f"ERROR: {label} pattern not found")
        ok = False

if ok:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("saved")
