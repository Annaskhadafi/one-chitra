const fs = require('fs');

function patchSalesOrderDetail() {
    const filePath = 'd:/[01] PROJECT/one chitra/app/dashboard/sales-orders/_components/sales-order-detail.tsx';
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    if (!content.includes('AuditLogView')) {
        content = content.replace(
            'import { Pencil, MapPin, Mail, FileText } from "lucide-react"',
            'import { Pencil, MapPin, Mail, FileText, History, FileStack } from "lucide-react"\nimport { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"\nimport { AuditLogView } from "@/components/audit-log-view"'
        );

        content = content.replace(
            '<div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 bg-slate-50/5">',
            '<div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 bg-slate-50/5">\n                    <Tabs defaultValue="details" className="w-full">\n                        <div className="sticky top-0 z-20 mx-auto max-w-7xl px-4 pt-4 sm:px-12 bg-white/80 backdrop-blur-sm">\n                            <TabsList className="grid w-full grid-cols-2 max-w-[400px]">\n                                <TabsTrigger value="details" className="gap-2">\n                                    <FileStack className="h-3.5 w-3.5" />\n                                    Order details\n                                </TabsTrigger>\n                                <TabsTrigger value="history" className="gap-2">\n                                    <History className="h-3.5 w-3.5" />\n                                    Activity History\n                                </TabsTrigger>\n                            </TabsList>\n                        </div>\n\n                        <TabsContent value="details">'
        );

        content = content.replace(
            '                    </div>\n                </div>',
            '                            </div>\n                        </TabsContent>\n\n                        <TabsContent value="history">\n                            <div className="mx-auto my-4 max-w-7xl space-y-6 rounded-lg border border-slate-100 bg-white px-4 py-6 shadow-sm sm:my-8 sm:px-12 sm:py-10">\n                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">User Activity Log</h3>\n                                <AuditLogView tableName="sales_orders" recordId={order.id.toString()} />\n                            </div>\n                        </TabsContent>\n                    </Tabs>\n                </div>'
        );
    }

    fs.writeFileSync(filePath, content);
}

function patchDeliveryPreview() {
    const filePath = 'd:/[01] PROJECT/one chitra/app/dashboard/deliveries/_components/delivery-preview.tsx';
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    if (!content.includes('AuditLogView')) {
        content = content.replace(
            'CheckCircle2\n} from "lucide-react"',
            'CheckCircle2,\n    History\n} from "lucide-react"\nimport { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"\nimport { AuditLogView } from "@/components/audit-log-view"'
        );

        content = content.replace(
            '<div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">',
            '<div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">\n                    <Tabs defaultValue="preview" className="w-full">\n                        <div className="sticky top-0 z-20 px-6 py-2 bg-background/80 backdrop-blur-sm border-b">\n                            <TabsList className="grid w-[400px] grid-cols-2">\n                                <TabsTrigger value="preview">Detail Delivery</TabsTrigger>\n                                <TabsTrigger value="history" className="gap-2">\n                                    <History className="h-3.5 w-3.5" />\n                                    Riwayat Aktivitas\n                                </TabsTrigger>\n                            </TabsList>\n                        </div>\n\n                        <TabsContent value="preview">'
        );

        content = content.replace(
            '                    </div>\n                </div>',
            '                            </div>\n                        </TabsContent>\n\n                        <TabsContent value="history">\n                            <div className="max-w-4xl mx-auto my-8 p-8 bg-white dark:bg-slate-950 shadow-xl border rounded-md">\n                                <h3 className="text-sm font-bold flex items-center gap-2 text-primary uppercase tracking-wider mb-6">\n                                    <History className="h-4 w-4" />\n                                    User Activity Log\n                                </h3>\n                                <AuditLogView tableName="deliveries" recordId={delivery.id.toString()} />\n                            </div>\n                        </TabsContent>\n                    </Tabs>\n                </div>'
        );
    }

    fs.writeFileSync(filePath, content);
}

patchSalesOrderDetail();
patchDeliveryPreview();
console.log('UI Patched');
