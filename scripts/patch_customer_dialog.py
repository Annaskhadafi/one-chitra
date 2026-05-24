import os
base = r"D:/[01] PROJECT/one-chitra"
path = os.path.join(base, "app/dashboard/customers/_components/customer-dialog.tsx")

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Add Select imports
old_imports = '''import { Input } from "@/components/ui/input"
import { toast } from "sonner"'''
new_imports = '''import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"'''

# Add businessCategory to defaultValues
old_defaults = '''        defaultValues: {
            customerCode: customer?.customerCode || "",
            name: customer?.name || "",
            contactName: customer?.contactName || "",
            email: customer?.email || "",
            address1: customer?.address1 || "",
            address2: customer?.address2 || "",
            address3: customer?.address3 || "",
            address4: customer?.address4 || "",
            address5: customer?.address5 || "",
        },'''
new_defaults = '''        defaultValues: {
            customerCode: customer?.customerCode || "",
            name: customer?.name || "",
            contactName: customer?.contactName || "",
            email: customer?.email || "",
            address1: customer?.address1 || "",
            address2: customer?.address2 || "",
            address3: customer?.address3 || "",
            address4: customer?.address4 || "",
            address5: customer?.address5 || "",
            businessCategory: customer?.businessCategory || "",
        },'''

# Add businessCategory field before Address Information section
old_address_section = '''                        <h3 className="font-medium">Address Information</h3>'''
new_address_section = '''                        <h3 className="font-medium">Kategori Bisnis</h3>
                            <FormField
                                control={form.control}
                                name="businessCategory"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Kategori Bisnis</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Pilih kategori bisnis..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Mining Contractor">Mining Contractor</SelectItem>
                                                <SelectItem value="Mining Owner">Mining Owner</SelectItem>
                                                <SelectItem value="Perkebunan">Perkebunan</SelectItem>
                                                <SelectItem value="Konstruksi">Konstruksi</SelectItem>
                                                <SelectItem value="Minyak dan Gas">Minyak dan Gas</SelectItem>
                                                <SelectItem value="Kehutanan">Kehutanan</SelectItem>
                                                <SelectItem value="Transportasi dan Logistik">Transportasi dan Logistik</SelectItem>
                                                <SelectItem value="Pemerintah">Pemerintah</SelectItem>
                                                <SelectItem value="Manufaktur">Manufaktur</SelectItem>
                                                <SelectItem value="Perdagangan">Perdagangan</SelectItem>
                                                <SelectItem value="Quarry">Quarry</SelectItem>
                                                <SelectItem value="Agribisnis">Agribisnis</SelectItem>
                                                <SelectItem value="Lainnya">Lainnya</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        <h3 className="font-medium mt-2">Address Information</h3>'''

ok = True
if old_imports not in content:
    print("ERROR: imports pattern not found"); ok = False
if old_defaults not in content:
    print("ERROR: defaults pattern not found"); ok = False
if old_address_section not in content:
    print("ERROR: address section pattern not found"); ok = False

if ok:
    content = content.replace(old_imports, new_imports)
    content = content.replace(old_defaults, new_defaults)
    content = content.replace(old_address_section, new_address_section)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("patched customer-dialog.tsx")
