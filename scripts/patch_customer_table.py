import os
base = r"D:/[01] PROJECT/one-chitra"
path = os.path.join(base, "app/dashboard/customers/_components/customer-table.tsx")

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Add import statement after CustomerCSVUpload import
old_import = 'import { CustomerCSVUpload } from "./customer-table-csv"'
new_import = 'import { CustomerCSVUpload } from "./customer-table-csv"\nimport { CustomerSAPImportDialog } from "./customer-sap-import-dialog"'

# Add button in the canCreate block
old_buttons = '''                    {canCreate && (
                        <>
                            <CustomerCSVUpload />
                            <CustomerDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["customers"] })} />
                        </>
                    )}'''
new_buttons = '''                    {canCreate && (
                        <>
                            <CustomerSAPImportDialog />
                            <CustomerCSVUpload />
                            <CustomerDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["customers"] })} />
                        </>
                    )}'''

if old_import in content and old_buttons in content:
    content = content.replace(old_import, new_import)
    content = content.replace(old_buttons, new_buttons)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("patched customer-table.tsx")
else:
    print("pattern not found")
    if old_import not in content:
        print("  - import pattern missing")
    if old_buttons not in content:
        print("  - buttons pattern missing")
