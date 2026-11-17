import os
from pypdf import PdfReader

targets = [
    ("4808", "public/uploads/vendor-invoices/sharepoint/3474_ODG - 4808.pdf"),
    ("AJP/2610/4537", "public/uploads/vendor-invoices/sharepoint/3448_AJP - AJP26104537.pdf"),
    ("MGK02601803", "public/uploads/vendor-invoices/sharepoint/3473_MENTARI - MGK02601803.pdf")
]

os.makedirs("scripts/sharepoint-migration/ocr_samples", exist_ok=True)

for inv_num, pdf_path in targets:
    reader = PdfReader(pdf_path)
    page1 = reader.pages[0]
    safe_name = inv_num.replace("/", "_")
    
    saved = False
    for idx, img in enumerate(page1.images):
        img_ext = img.name.split(".")[-1] if "." in img.name else "jpg"
        out_path = f"scripts/sharepoint-migration/ocr_samples/{safe_name}_page1.{img_ext}"
        with open(out_path, "wb") as f:
            f.write(img.data)
        print(f"Extracted image for {inv_num}: {out_path} ({len(img.data)} bytes)")
        saved = True
        break
    
    if not saved:
        print(f"No image in page 1 for {inv_num}")
