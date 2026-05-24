import os
base = r"D:/[01] PROJECT/one-chitra"
files = [
    "app/actions/customer-tire-history.ts",
    "app/dashboard/marketing/customer-tire-history/page.tsx",
    "app/dashboard/marketing/customer-tire-history/_components/customer-tire-history-client.tsx",
    "lib/navigation.ts",
    "lib/route-permissions.ts",
]
for f in files:
    p = os.path.join(base, f.replace("/", os.sep))
    exists = os.path.exists(p)
    size = os.path.getsize(p) if exists else 0
    print(f"{os.path.basename(f)}: exists={exists} size={size}")
    if exists:
        with open(p, "r", encoding="utf-8") as fh: c = fh.read()
        with open(p, "w", encoding="utf-8") as fh: fh.write(c)
