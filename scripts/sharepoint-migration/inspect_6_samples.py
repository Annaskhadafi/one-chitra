import json
import os
import sys

with open("scripts/sharepoint-migration/pending_185.json", encoding="utf-8") as f:
    items = json.load(f)

targets = [
    "110/RB/CP/PCRC/X/2026",
    "107/RB/CP/PCRC/VII/2026",
    "MGK 02601749",
    "INV/DJU-1167/IX/2026",
    "015E2609-05587",
    "025/INV-GJMBPN/VII/2026",
]

found_items = []
for t in targets:
    clean_t = t.strip()
    matches = [it for it in items if clean_t.lower() in it["invoiceNumber"].lower()]
    print(f"Target '{clean_t}': found {len(matches)} item(s)")
    for m in matches:
        print(f"  - ID: {m['id']}")
        print(f"    Invoice: {m['invoiceNumber']}")
        print(f"    File: {m['filePath']}")
        found_items.append(m)

with open("scripts/sharepoint-migration/matched_6_samples.json", "w", encoding="utf-8") as f:
    json.dump(found_items, f, indent=2)
