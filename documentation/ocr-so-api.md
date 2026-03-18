# API Internal: OCR → Sales Order

- POST /api/ocr-extract
  - Body: { fileUrl?: string, filename?: string, pages?: "all" | string | number[] }
  - Returns: { structured, productBoxes, entityBoxes, model, pagesProcessed, sessionId }
  - Logs: insert into ocr_extractions; creates ocr_po_sessions with extractedData

- POST /api/map-products
  - Body: { extracted: ExtractedSOData }
  - Returns: customer match + candidates, items mapping + confidence

- POST /api/draft-so
  - Body: { customerId, customerPo?, salesDate?, items: [{ productId, qty, unitPrice, discount, tax }], ... }
  - Returns: { id, status }

- PUT /api/draft-so
  - Body: { id, status?, items?, notes?, discount?, shipping? }
  - Returns: { id }
  - Logs: audit_logs (UPDATE_SO_DRAFT)

- POST /api/confirm-so
  - Body: { id }
  - Returns: { id, status: "tervalidasi" }
  - Logs: audit_logs (CONFIRM_SO)

Environment:
- MISTRAL_API_KEY
- MISTRAL_OCR_ENDPOINT

Presisi & Batasan:
- Target presisi OCR ≥ 95% untuk teks Latin dan angka, bergantung pada kualitas dokumen input dan konfigurasi Mistral OCR.
- Batasi permintaan maksimal ±4k token melalui pengendalian prompt dan format output.
