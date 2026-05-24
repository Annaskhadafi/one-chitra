import openpyxl, json, os, subprocess, sys

# Read Excel
wb = openpyxl.load_workbook(r'C:/Users/Anas/OneDrive - PT Mitra Solusi Telematika/Downloads/Customer-Category-Usaha-Edited.xlsx')
ws = wb.active
rows = list(ws.iter_rows(values_only=True))

data = []
for r in rows[1:]:
    name = str(r[0] or "").strip()
    cat  = str(r[1] or "").strip()
    if name and cat:
        data.append({"name": name, "category": cat})

print(f"Loaded {len(data)} rows from Excel")

# Write JSON to temp file
json_path = r"D:/[01] PROJECT/one-chitra/tmp/excel_categories.json"
os.makedirs(os.path.dirname(json_path), exist_ok=True)
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)
print(f"Written to {json_path}")
