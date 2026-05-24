import os
base = r"D:/[01] PROJECT/one-chitra"
files = [
    "app/dashboard/customer-industry/page.tsx",
    "app/dashboard/customer-industry/_components/customer-industry-client.tsx",
    "app/api/customer-industry-enrich/route.ts",
    "app/actions/customer-industry.ts",
    "drizzle/0043_customer_business_category.sql",
    "db/schema/customers.ts",
]
for f in files:
    p = os.path.join(base, f.replace("/", os.sep))
    exists = os.path.exists(p)
    size = os.path.getsize(p) if exists else 0
    print(f"{f}: exists={exists} size={size}")
