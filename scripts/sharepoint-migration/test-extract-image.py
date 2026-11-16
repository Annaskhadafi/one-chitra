from pypdf import PdfReader
import os

reader = PdfReader("public/uploads/vendor-invoices/sharepoint/3474_ODG - 4808.pdf")
print("Total Pages:", len(reader.pages))
page1 = reader.pages[0]
print("Images in Page 1:", len(page1.images))
for idx, img in enumerate(page1.images):
    print(f"Image {idx}: {img.name}, length: {len(img.data)} bytes")
    # Simpan halaman 1 sebagai sample jpg
    with open("scripts/sharepoint-migration/sample_page1.jpg", "wb") as f:
        f.write(img.data)
    print("Saved sample_page1.jpg successfully!")
    break
