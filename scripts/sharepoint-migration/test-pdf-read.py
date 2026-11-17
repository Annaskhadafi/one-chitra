import sys
from pypdf import PdfReader

def extract_pdf(filepath):
    print(f"=== Reading {filepath} ===")
    reader = PdfReader(filepath)
    print(f"Total Pages: {len(reader.pages)}")
    full_text = ""
    for idx, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        full_text += f"\n--- Page {idx+1} ---\n" + text
    print("Excerpt (first 1000 chars):")
    print(full_text[:1000])
    return full_text

if __name__ == "__main__":
    files = [
        "public/uploads/vendor-invoices/sharepoint/3474_ODG - 4808.pdf",
        "public/uploads/vendor-invoices/sharepoint/3448_AJP - AJP26104537.pdf",
        "public/uploads/vendor-invoices/sharepoint/3473_MENTARI - MGK02601803.pdf"
    ]
    for f in files:
        try:
            extract_pdf(f)
        except Exception as e:
            print(f"Error {f}: {e}")
