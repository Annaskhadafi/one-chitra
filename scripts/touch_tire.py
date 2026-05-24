import os
base = r"D:/[01] PROJECT/one-chitra"
files = [
    "app/actions/customer-tire-history.ts",
    "app/dashboard/marketing/customer-tire-history/_components/customer-tire-history-client.tsx",
]
for f in files:
    p = os.path.join(base, f.replace("/", os.sep))
    with open(p, "r", encoding="utf-8") as fh: c = fh.read()
    with open(p, "w", encoding="utf-8") as fh: fh.write(c)
    print("touched", os.path.basename(p))
