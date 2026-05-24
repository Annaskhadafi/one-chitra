import re

base = r"D:/[01] PROJECT/one-chitra"

# Fix route-permissions.ts
rp_path = base + "/lib/route-permissions.ts"
with open(rp_path, "r", encoding="utf-8") as f:
    rp = f.read()

new_entry = '    { prefix: "/dashboard/customer-industry", resource: "customer-segmentation" },\n'
if "/dashboard/customer-industry" not in rp:
    rp = rp.replace(
        '{ prefix: "/dashboard/customer-segmentation", resource: "customer-segmentation" },',
        '{ prefix: "/dashboard/customer-segmentation", resource: "customer-segmentation" },\n' + new_entry.rstrip()
    )
    with open(rp_path, "w", encoding="utf-8") as f:
        f.write(rp)
    print("route-permissions.ts updated")
else:
    print("route-permissions.ts already has entry")

# Fix navigation.ts
nav_path = base + "/lib/navigation.ts"
with open(nav_path, "r", encoding="utf-8") as f:
    nav = f.read()

new_nav_entry = '''                    {
                        title: "Customer Industry Mapping",
                        url: "/dashboard/customer-industry",
                        resource: "customer-segmentation",
                    },'''

if "/dashboard/customer-industry" not in nav:
    nav = nav.replace(
        '                    {\n                        title: "Customer Segmentasi",\n                        url: "/dashboard/customer-segmentation",\n                        resource: "customer-segmentation",\n                    },',
        '                    {\n                        title: "Customer Segmentasi",\n                        url: "/dashboard/customer-segmentation",\n                        resource: "customer-segmentation",\n                    },\n' + new_nav_entry
    )
    with open(nav_path, "w", encoding="utf-8") as f:
        f.write(nav)
    print("navigation.ts updated")
else:
    print("navigation.ts already has entry")
