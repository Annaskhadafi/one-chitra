import openpyxl, re

wb = openpyxl.load_workbook(r'C:/Users/Anas/OneDrive - PT Mitra Solusi Telematika/Downloads/Customer-Category-Usaha-Edited.xlsx')
ws = wb.active
rows = list(ws.iter_rows(values_only=True))

# Get all unique categories
cats = set()
for r in rows[1:]:
    if r[1]: cats.add(str(r[1]).strip())
print("Unique categories:")
for c in sorted(cats):
    print(" -", c)
print("Total:", len(cats))
