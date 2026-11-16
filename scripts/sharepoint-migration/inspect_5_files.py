import os
import pypdfium2 as pdfium
import re

files_to_check = [
    ("110/RB/CP/PCRC/X/2026", r"D:\one chitra\one-chitra\public\uploads\vendor-invoices\sharepoint\3445_REAL BORNEO - 110RBCPPCRCX2026.pdf"),
    ("107/RB/CP/PCRC/VII/2026", r"D:\one chitra\one-chitra\public\uploads\vendor-invoices\sharepoint\2817_REAL BORNEO - 107RBCPPCRCVII2026.pdf"),
    ("INV/DJU-1167/IX/2026", r"D:\one chitra\one-chitra\public\uploads\vendor-invoices\sharepoint\3135_DJU - NVDJU-1167IX2026.pdf"),
    ("015E2609-05587", r"D:\one chitra\one-chitra\public\uploads\vendor-invoices\sharepoint\3108_ARK - 01SE2609-05587.pdf"),
    ("025/INV-GJMBPN/VII/2026", r"D:\one chitra\one-chitra\public\uploads\vendor-invoices\sharepoint\2830_GJM - 025INV-GJMBPNVII2026.pdf"),
]

print("=== CHECKING 5 DIRECT FILES ===")
for inv, path in files_to_check:
    print(f"\n>> Invoice: {inv}")
    print(f"   Path: {path}")
    if not os.path.exists(path):
        print("   FILE NOT FOUND!")
        continue
    pdf = pdfium.PdfDocument(path)
    total_pages = len(pdf)
    print(f"   Total Pages: {total_pages}")
    
    # Check text across all pages
    found_text_po = []
    for i in range(total_pages):
        txt = pdf[i].get_textpage().get_text_range()
        # Look for 10 digit PO
        m = re.findall(r'\b(82\d{8}|81\d{8}|45\d{8})\b', txt)
        if m:
            found_text_po.append((i+1, m))
        # Look for PO keywords
        kw = re.findall(r'(?:PO|P\.O|Purchase Order|SPK|Order No)[\s:\.]*([A-Za-z0-9\/\-_]+)', txt, re.IGNORECASE)
        if kw:
            print(f"   [P{i+1} keyword match]: {kw}")
            
    if found_text_po:
        print(f"   FOUND PO in text: {found_text_po}")
    else:
        print("   No PO found in text layer (may be scanned image).")
