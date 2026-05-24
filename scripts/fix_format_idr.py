import os
base = r"D:/[01] PROJECT/one-chitra"
path = os.path.join(base, "app/dashboard/marketing/customer-tire-history/_components/customer-tire-history-client.tsx")

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = '''function formatIDR(val: number) {
    if (val >= 1_000_000_000) return "Rp " + (val / 1_000_000_000).toFixed(1) + "B"
    if (val >= 1_000_000) return "Rp " + (val / 1_000_000).toFixed(1) + "M"
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)
}'''

new = '''function formatIDR(val: number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)
}'''

if old in content:
    content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("patched formatIDR")
else:
    print("pattern not found")
