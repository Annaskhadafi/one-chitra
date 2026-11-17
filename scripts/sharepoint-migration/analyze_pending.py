import os
import sys
import re
import json
import pypdfium2 as pdfium

json_path = os.path.join(os.path.dirname(__file__), "pending_185.json")
with open(json_path, "r", encoding="utf-8") as f:
    items = json.load(f)

print(f"Loaded {len(items)} items from pending_185.json")

PO_REGEX = re.compile(r'\b(82\d{8}|81\d{8}|45\d{8})\b')

results = {
    "text_found": [],
    "more_than_5_pages": [],
    "single_page": [],
    "file_missing": [],
    "multi_page_no_text": []
}

for item in items:
    inv_id = item["id"]
    inv_num = item["invoiceNumber"]
    file_path = item.get("filePath")

    if not file_path or not os.path.exists(file_path):
        results["file_missing"].append({"id": inv_id, "inv": inv_num, "path": file_path})
        continue

    try:
        pdf = pdfium.PdfDocument(file_path)
        total_pages = len(pdf)
        
        found_in_text = False
        found_po = None
        found_page = None

        for p_idx in range(total_pages):
            text = pdf[p_idx].get_textpage().get_text_range()
            m = PO_REGEX.search(text)
            if m:
                found_in_text = True
                found_po = m.group(1)
                found_page = p_idx + 1
                break

        if found_in_text:
            results["text_found"].append({
                "id": inv_id,
                "inv": inv_num,
                "po": found_po,
                "page": found_page,
                "total_pages": total_pages,
                "file": file_path
            })
        else:
            if total_pages == 1:
                results["single_page"].append({"id": inv_id, "inv": inv_num, "file": file_path})
            elif total_pages > 5:
                results["more_than_5_pages"].append({"id": inv_id, "inv": inv_num, "total_pages": total_pages, "file": file_path})
            else:
                results["multi_page_no_text"].append({"id": inv_id, "inv": inv_num, "total_pages": total_pages, "file": file_path})
    except Exception as e:
        results["file_missing"].append({"id": inv_id, "inv": inv_num, "error": str(e)})

print(f"\n==========================================")
print(f"📊 HASIL ANALISIS 185 INVOICE BELUM BER-PO:")
print(f"==========================================")
print(f"1. LANGSUNG DITEMUKAN di Text Layer PDF (Semua Halaman): {len(results['text_found'])} invoice")
print(f"2. Memiliki Lebih dari 5 Halaman (> 5 hal)              : {len(results['more_than_5_pages'])} invoice")
print(f"3. Dokumen 2 s/d 5 Halaman (Scan Gambar/Image murni)    : {len(results['multi_page_no_text'])} invoice")
print(f"4. Dokumen Single Page (Hanya 1 Halaman)               : {len(results['single_page'])} invoice")
print(f"5. Berkas PDF Tidak Ditemukan di Disk                  : {len(results['file_missing'])} invoice")
print(f"==========================================\n")

if results["text_found"]:
    print("Contoh PO yang langsung ditemukan via Text Layer:")
    for tf in results["text_found"][:10]:
        print(f" - Inv: {tf['inv'].padEnd(25) if hasattr(tf['inv'], 'padEnd') else tf['inv']} -> PO: {tf['po']} (Halaman {tf['page']} dari {tf['total_pages']})")

out_analysis = os.path.join(os.path.dirname(__file__), "analysis_results.json")
with open(out_analysis, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print(f"\nDetail lengkap disimpan ke {out_analysis}")
