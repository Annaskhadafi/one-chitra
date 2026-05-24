import os
base = r"D:/[01] PROJECT/one-chitra"

# Fix navigation.ts - add to Marketing section
nav_path = os.path.join(base, "lib/navigation.ts")
with open(nav_path, "r", encoding="utf-8") as f:
    nav = f.read()

old = '''                    {
                        title: "Campaign Manager",
                        url: "/dashboard/marketing/campaigns",
                        resource: "marketing",
                    },'''

new = '''                    {
                        title: "Customer History Tire",
                        url: "/dashboard/marketing/customer-tire-history",
                        resource: "marketing",
                    },
                    {
                        title: "Campaign Manager",
                        url: "/dashboard/marketing/campaigns",
                        resource: "marketing",
                    },'''

if old in nav:
    nav = nav.replace(old, new)
    with open(nav_path, "w", encoding="utf-8") as f:
        f.write(nav)
    print("navigation.ts updated")
else:
    print("ERROR: pattern not found")

# Fix route-permissions.ts
rp_path = os.path.join(base, "lib/route-permissions.ts")
with open(rp_path, "r", encoding="utf-8") as f:
    rp = f.read()

if "/dashboard/marketing/customer-tire-history" not in rp:
    rp = rp.replace(
        '{ prefix: "/dashboard/marketing", resource: "marketing" },',
        '{ prefix: "/dashboard/marketing", resource: "marketing" },\n    { prefix: "/dashboard/marketing/customer-tire-history", resource: "marketing" },'
    )
    with open(rp_path, "w", encoding="utf-8") as f:
        f.write(rp)
    print("route-permissions.ts updated")
else:
    print("route-permissions.ts already has entry")
