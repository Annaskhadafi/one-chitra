import urllib.request, urllib.parse, json, ssl

conn_str = "postgresql://satuchitra:Wusthochq2018-@31.97.187.38:5432/satuchitra"

sql = """
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_category varchar(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_category_source varchar(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_category_enriched_at timestamp;
"""

import subprocess, sys

result = subprocess.run(
    ["npx", "tsx", "-e", f"""
import {{ db }} from "@/db"
import {{ sql }} from "drizzle-orm"

async function migrate() {{
  await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_category varchar(255)`)
  await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_category_source varchar(100)`)
  await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_category_enriched_at timestamp`)
  console.log("Migration done")
  process.exit(0)
}}
migrate().catch(e => {{ console.error(e); process.exit(1) }})
"""],
    capture_output=True, text=True, cwd=r"D:/[01] PROJECT/one-chitra"
)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr[:500] if result.stderr else "")
print("RC:", result.returncode)
