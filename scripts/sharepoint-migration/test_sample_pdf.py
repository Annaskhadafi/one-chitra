import os
import re
import json
from pypdf import PdfReader

# Pola PO SAP PT Chitra Paratama:
# 10 digit, diawali 82 (kontrak/jasa), 81, atau 45 (material/sparepart)
PO_REGEX = re.compile(r'\b(82\d{8}|81\d{8}|45\d{8})\b')

target_dir = 'public/uploads/vendor-invoices/sharepoint'
pdf_files = [os.path.join(target_dir, f) for f in os.listdir(target_dir) if f.endswith('.pdf')]

print(f"Total file PDF di folder: {len(pdf_files)}")

# Kita uji sampel 100 file pertama
found_count = 0
empty_text_count = 0

for idx, p in enumerate(pdf_files[:100]):
    try:
        reader = PdfReader(p)
        text = ""
        for page in reader.pages[:3]: # cek hingga 3 halaman pertama
            t = page.extract_text() or ""
            text += t + " "
        
        matches = PO_REGEX.findall(text)
        if matches:
            found_count += 1
            if idx < 5:
                print(f"[{os.path.basename(p)}] -> PO ditemukan via Text: {matches[0]}")
        elif len(text.strip()) < 50:
            empty_text_count += 1
    except Exception as e:
        pass

print(f"\n📊 Hasil Tes Sampel 100 PDF:")
print(f"✅ PO ditemukan langsung via teks digital: {found_count}%")
print(f"📄 PDF scan murni (teks kosong): {empty_text_count}%")
print(f"🔍 Sisanya (teks ada tapi PO butuh OCR/analisis mendalam): {100 - found_count - empty_text_count}%")
