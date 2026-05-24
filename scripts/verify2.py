import os
files = [
    r"D:/[01] PROJECT/one-chitra/app/actions/customer-sap-import.ts",
    r"D:/[01] PROJECT/one-chitra/app/dashboard/customers/_components/customer-sap-import-dialog.tsx",
]
for f in files:
    p = f.replace("/", os.sep)
    exists = os.path.exists(p)
    size = os.path.getsize(p) if exists else 0
    print(f"{os.path.basename(f)}: exists={exists} size={size}")
