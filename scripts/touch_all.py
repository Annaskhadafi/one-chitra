import os
base = r"D:/[01] PROJECT/one-chitra"
files = [
    "lib/schemas.ts",
    "app/actions/customer.ts",
    "app/dashboard/customers/_components/customer-dialog.tsx",
    "app/dashboard/customers/_components/customer-table.tsx",
]
for f in files:
    p = os.path.join(base, f.replace("/", os.sep))
    with open(p, "r", encoding="utf-8") as fh:
        c = fh.read()
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(c)
    print("touched", f)
