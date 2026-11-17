import sys
import os
import pypdfium2 as pdfium

def render_pdf_page(pdf_path, out_jpg_path, page_num=1, scale=1.5):
    try:
        pdf = pdfium.PdfDocument(pdf_path)
        total_pages = len(pdf)
        idx = page_num - 1
        if idx < 0 or idx >= total_pages:
            return False, total_pages
        page = pdf[idx]
        image = page.render(scale=scale).to_pil()
        os.makedirs(os.path.dirname(out_jpg_path), exist_ok=True)
        image.save(out_jpg_path, "JPEG", quality=85)
        return True, total_pages
    except Exception as e:
        sys.stderr.write(f"Render error: {e}\n")
        return False, 0

if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(1)
    pdf_in = sys.argv[1]
    jpg_out = sys.argv[2]
    page_num = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    scale = float(sys.argv[4]) if len(sys.argv) > 4 else 1.5
    success, total = render_pdf_page(pdf_in, jpg_out, page_num, scale)
    if success:
        print(f"SUCCESS:{total}")
        sys.exit(0)
    else:
        sys.exit(1)
