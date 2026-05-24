import os
files = [
    r"D:/[01] PROJECT/one-chitra/app/actions/customer-sap-import.ts",
    r"D:/[01] PROJECT/one-chitra/app/dashboard/customers/_components/customer-sap-import-dialog.tsx",
    r"D:/[01] PROJECT/one-chitra/app/dashboard/customers/_components/customer-table.tsx",
]
for f in files:
    p = f.replace("/", os.sep)
    with open(p, "r", encoding="utf-8") as fh:
        c = fh.read()
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(c)
    print("touched", os.path.basename(p))
