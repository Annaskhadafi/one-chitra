
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
    getEvhsReceipts, 
    getPendingEvhsTransfers, 
    getEvhsVouchers,
    getEvhsTrackingData
} from "@/app/actions/evhs"
import { getWarehouses } from "@/app/actions/warehouse"
import { getProducts } from "@/app/actions/product"

// Shared components
import { EvhsReceiptTable } from "./_components/evhs-receipt-table"
import { EvhsTrackingTable } from "./_components/evhs-tracking-table"
import { EvhsVoucherTable } from "./_components/evhs-voucher-table"
import { EvhsGiMatching } from "./_components/evhs-gi-matching"
import { EvhsMrkoTable } from "./_components/evhs-mrko-table"
import { EvhsMasterPriceTable } from "./_components/evhs-master-price-table"

export default async function EvhsPage() {
    // Initial data fetching
    const receipts = await getEvhsReceipts()
    const pendingTransfers = await getPendingEvhsTransfers()
    const vouchers = await getEvhsVouchers()
    const warehouses = await getWarehouses()
    const products = await getProducts()
    const trackingData = await getEvhsTrackingData()

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">E-VHS Management</h1>
                <p className="text-muted-foreground">
                    Vendor Held Stock (VHS) management for PT Cipta Kridatama Site.
                </p>
            </div>

            <Tabs id="evhs-tabs" defaultValue="receipts" className="space-y-4">
                <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="receipts">Penerimaan</TabsTrigger>
                    <TabsTrigger value="stock">Stock VHS & WO</TabsTrigger>
                    <TabsTrigger value="vouchers">Voucher VHS</TabsTrigger>
                    <TabsTrigger value="gi-matching">GI Matching</TabsTrigger>
                    <TabsTrigger value="mrko">MRKO & Invoice</TabsTrigger>
                    <TabsTrigger value="master-price">Master Price CK</TabsTrigger>
                </TabsList>

                {/* Tab 1: Penerimaan */}
                <TabsContent value="receipts" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Konfirmasi Penerimaan</CardTitle>
                            <CardDescription>
                                Konfirmasi barang yang datang dari Stock Transfer VHS/Consignment.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <EvhsReceiptTable 
                                receipts={receipts} 
                                pendingTransfers={pendingTransfers} 
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 2: Stock VHS & WO */}
                <TabsContent value="stock" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Inventory Site VHS (Tracking)</CardTitle>
                            <CardDescription>
                                Monitoring histori stok per serial number dan input penggunaan barang.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <EvhsTrackingTable 
                                trackingData={trackingData}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 3: Voucher VHS */}
                <TabsContent value="vouchers" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Voucher VHS (Usage)</CardTitle>
                            <CardDescription>
                                Generate voucher serah terima barang ke customer.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <EvhsVoucherTable 
                                vouchers={vouchers}
                                products={products}
                                warehouses={warehouses}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 4: GI Matching */}
                <TabsContent value="gi-matching" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Crosscheck Data GI</CardTitle>
                            <CardDescription>
                                Bandingkan data pengeluaran (GI) Chitra vs Excel Harian Customer.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <EvhsGiMatching />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 5: MRKO & Invoice */}
                <TabsContent value="mrko" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>MRKO & Invoicing</CardTitle>
                            <CardDescription>
                                Tracking status MRKO dan integrasi nomor invoice SAP.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <EvhsMrkoTable />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 6: Master Data Price */}
                <TabsContent value="master-price" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Master Price PT. CK</CardTitle>
                            <CardDescription>
                                Pengaturan harga khusus Cipta Kridatama untuk kalkulasi GI Matching.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <EvhsMasterPriceTable warehouses={warehouses} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
