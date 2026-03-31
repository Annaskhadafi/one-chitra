const fs = require('fs');

function patchDeliveryTable() {
    const filePath = 'd:/[01] PROJECT/one chitra/app/dashboard/deliveries/_components/delivery-table.tsx';
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    if (!content.includes('DeliveryBulkPdf')) {
        // 1. Add import
        content = content.replace(
            'import { DeliveryPdfPreview } from "./delivery-pdf-preview"',
            'import { DeliveryPdfPreview } from "./delivery-pdf-preview"\nimport { DeliveryBulkPdf } from "./delivery-bulk-pdf"'
        );

        // 2. Add state
        content = content.replace(
            'const [isPoPreviewOpen, setIsPoPreviewOpen] = useState(false)',
            'const [isPoPreviewOpen, setIsPoPreviewOpen] = useState(false)\n    const [isBulkPdfOpen, setIsBulkPdfOpen] = useState(false)'
        );

        // 3. Add Bulk PDF button next to BulkActions or similar
        // I'll find the place where BulkActions is rendered
        content = content.replace(
            '<BulkActions',
            '<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">\n                <Button \n                    variant="default" \n                    size="sm" \n                    className="shadow-lg h-10 px-4 bg-emerald-600 hover:bg-emerald-700 animate-in slide-in-from-bottom-5"\n                    onClick={() => setIsBulkPdfOpen(true)}\n                >\n                    <FileStack className="h-4 w-4 mr-2" />\n                    Cetak Bulk PDF ({Object.keys(rowSelection).length})\n                </Button>\n                <BulkActions'
        );
        
        // Wait, I need to close the div
        content = content.replace(
            'entityName="Delivery"\n            />',
            'entityName="Delivery"\n            />\n            </div>'
        );

        // 4. Add the Dialog at the bottom
        content = content.replace(
            '</Sheet>',
            '</Sheet>\n\n            <DeliveryBulkPdf \n                deliveries={data.filter(d => rowSelection[d.id])} \n                open={isBulkPdfOpen} \n                onClose={() => setIsBulkPdfOpen(false)} \n            />'
        );
    }

    fs.writeFileSync(filePath, content);
}

patchDeliveryTable();
console.log('DeliveryTable Patched');
