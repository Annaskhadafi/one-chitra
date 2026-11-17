import os
import sys
import re
import json
import pypdfium2 as pdfium

json_path = os.path.join(os.path.dirname(__file__), "pending_185.json")
with open(json_path, "r", encoding="utf-8") as f:
    items = json.load(f)

# Load already updated IDs
analysis_path = os.path.join(os.path.dirname(__file__), "analysis_results.json")
with open(analysis_path, "r", encoding="utf-8") as f:
    analysis = json.load(f)

updated_ids = set(x["id"] for x in analysis["text_found"])
remaining = [item for item in items if item["id"] not in updated_ids]

print(f"Total remaining without PO: {len(remaining)}")

# Check pattern variants in text:
# e.g., 82 followed by 8 digits with spaces/hyphens/dots: 82[.\-\s]?\d[.\-\s]?\d...
FUZZY_PO_REGEX = re.compile(r'\b(82|81|45)[\s\.\-_/]?(\d[\s\.\-_/]?){8}\b')
KEYWORD_REGEX = re.compile(r'(purchase\s*order|p\.o\.?|nomor\s*po|no\.?\s*po|spk|surat\s*pesanan)', re.IGNORECASE)

fuzzy_found = []
has_po_keyword = []
pure_scans = []
short_docs = []

for item in remaining:
    file_path = item.get("filePath")
    if not file_path or not os.path.exists(file_path):
        continue

    try:
        pdf = pdfium.PdfDocument(file_path)
        total_pages = len(pdf)
        all_text = ""
        kw_pages = []
        fuzzy_matches = []

        for p_idx in range(total_pages):
            txt = pdf[p_idx].get_textpage().get_text_range()
            if txt:
                all_text += f"\n[P{p_idx+1}] " + txt
                if KEYWORD_REGEX.search(txt):
                    kw_pages.append(p_idx + 1)
                
                # Check fuzzy PO
                # Clean spaces/dots in text and test
                cleaned_txt = re.sub(r'[\s\.\-_/]', '', txt)
                m = re.search(r'(82\d{8}|81\d{8}|45\d{8})', cleaned_txt)
                if m:
                    fuzzy_matches.append((p_idx + 1, m.group(1)))

        if fuzzy_matches:
            fuzzy_found.append({
                "id": item["id"],
                "inv": item["invoiceNumber"],
                "matches": fuzzy_matches,
                "total_pages": total_pages
            })
        elif kw_pages:
            has_po_keyword.append({
                "id": item["id"],
                "inv": item["invoiceNumber"],
                "kw_pages": kw_pages,
                "total_pages": total_pages,
                "file": file_path
            })
        elif len(all_text.strip()) < 100:
            pure_scans.append({
                "id": item["id"],
                "inv": item["invoiceNumber"],
                "total_pages": total_pages,
                "file": file_path
            })
        else:
            short_docs.append({
                "id": item["id"],
                "inv": item["invoiceNumber"],
                "total_pages": total_pages,
                "sample_text": all_text[:200]
            })
    except Exception as e:
        pass

print("\n--- BREAKDOWN SISA 140 INVOICE ---")
print(f"A. Fuzzy text match (angka terpisah spasi/titik): {len(fuzzy_found)}")
print(f"B. Ada kata kunci 'PO / Purchase Order' tapi format nomor beda: {len(has_po_keyword)}")
print(f"C. Pure Image Scan (Scan Gambar tanpa digital text): {len(pure_scans)}")
print(f"D. Dokumen Digital tapi bukan format PO SAP: {len(short_docs)}")

if fuzzy_found:
    print("\nFuzzy matches found:")
    for ff in fuzzy_found:
        print(f" - {ff['inv']}: {ff['matches']}")

if has_po_keyword:
    print(f"\nSample ada keyword PO ({len(has_po_keyword)} item):")
    for kw in has_po_keyword[:5]:
        print(f" - {kw['inv']}: hal {kw['kw_pages']} dari {kw['total_pages']}")

with open(os.path.join(os.path.dirname(__file__), "remaining_140_breakdown.json"), "w", encoding="utf-8") as f:
    json.dump({
        "fuzzy_found": fuzzy_found,
        "has_po_keyword": has_po_keyword,
        "pure_scans": pure_scans,
        "other_docs": short_docs
    }, f, indent=2)
