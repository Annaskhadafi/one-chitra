
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    getEvhsReceipts,
    getPendingEvhsTransfers,
    getEvhsVouchers,
    getEvhsTrackingData,
    getEvhsControlTowerData,
    getEvhsAllVhsStockData,
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
import { EvhsControlTower } from "./_components/evhs-control-tower"
import { EvhsAllVhsStockTable } from "./_components/evhs-all-vhs-stock-table"
import { EvhsStockOverviewTable } from "./_components/evhs-stock-overview-table"

export default async function EvhsPage() {
    // Initial data fetching
    const receipts = await getEvhsReceipts()
    const pendingTransfers = await getPendingEvhsTransfers()
    const vouchers = await getEvhsVouchers()
    const warehouses = await getWarehouses()
    const products = await getProducts()
    const trackingData = await getEvhsTrackingData()
    const controlTowerData = await getEvhsControlTowerData()
    const allVhsStockData = await getEvhsAllVhsStockData()

    return (
        <div className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">E-VHS Management</h1>
                <p className="text-muted-foreground">
                    Vendor Held Stock (VHS) management for PT Cipta Kridatama Site.
                </p>
            </div>

            <Tabs id="evhs-tabs" defaultValue="control-tower" className="space-y-3 sm:space-y-4">
                <TabsList className="w-full justify-start gap-1 overflow-x-auto bg-muted/50 p-1 whitespace-nowrap">
                    <TabsTrigger className="shrink-0" value="control-tower">Control Tower</TabsTrigger>
                    <TabsTrigger className="shrink-0" value="receipts">Penerimaan</TabsTrigger>
                    <TabsTrigger className="shrink-0" value="stock-all-vhs">Stock All VHS</TabsTrigger>
                    <TabsTrigger className="shrink-0" value="stock">Stock VHS & WO</TabsTrigger>
                    <TabsTrigger className="shrink-0" value="vouchers">Voucher VHS</TabsTrigger>
                    <TabsTrigger className="shrink-0" value="gi-matching">GI Matching</TabsTrigger>
                    <TabsTrigger className="shrink-0" value="mrko">MRKO & Invoice</TabsTrigger>
                    <TabsTrigger className="shrink-0" value="master-price">Master Price CK</TabsTrigger>
                </TabsList>

                {/* Tab 1: Control Tower */}
                <TabsContent value="control-tower" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>EVHS Control Tower</CardTitle>
                            <CardDescription>
                                Ringkasan ledger stok, reconciliation, aging, exception center, dan audit trail EVHS.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-3 pb-4 pt-0 sm:px-6 sm:pb-6">
                            <EvhsControlTower data={controlTowerData} />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 2: Penerimaan */}
                <TabsContent value="receipts" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Konfirmasi Penerimaan</CardTitle>
                            <CardDescription>
                                Konfirmasi barang yang datang dari Stock Transfer VHS/Consignment.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-3 pb-4 pt-0 sm:px-6 sm:pb-6">
                            <EvhsReceiptTable
                                receipts={receipts}
                                pendingTransfers={pendingTransfers}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 3: Stock All VHS */}
                <TabsContent value="stock-all-vhs" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Ringkasan Stock EVHS CK</CardTitle>
                            <CardDescription>
                                Rekap stock EVHS yang sudah terekam di tracking saat ini, termasuk indikasi kelengkapan SN.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-3 pb-4 pt-0 sm:px-6 sm:pb-6">
                            <EvhsStockOverviewTable trackingData={trackingData} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Stock All VHS</CardTitle>
                            <CardDescription>
                                Sinkronisasi stok lama dari inventory lokal untuk warehouse VHS CK, lengkap dengan detail SN/usage TYRE.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-3 pb-4 pt-0 sm:px-6 sm:pb-6">
                            <EvhsAllVhsStockTable rows={allVhsStockData} />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 4: Stock VHS & WO */}
                <TabsContent value="stock" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Inventory Site VHS (Tracking)</CardTitle>
                            <CardDescription>
                                Monitoring histori stok per serial number dan input penggunaan barang.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-3 pb-4 pt-0 sm:px-6 sm:pb-6">
                            <EvhsTrackingTable
                                trackingData={trackingData}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 5: Voucher VHS */}
                <TabsContent value="vouchers" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Voucher VHS (Usage)</CardTitle>
                            <CardDescription>
                                Generate voucher serah terima barang ke customer.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-3 pb-4 pt-0 sm:px-6 sm:pb-6">
                            <EvhsVoucherTable
                                vouchers={vouchers}
                                products={products}
                                warehouses={warehouses}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 6: GI Matching */}
                <TabsContent value="gi-matching" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Crosscheck Data GI</CardTitle>
                            <CardDescription>
                                Bandingkan data pengeluaran (GI) Chitra vs Excel Harian Customer.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-3 pb-4 pt-0 sm:px-6 sm:pb-6">
                            <EvhsGiMatching warehouses={warehouses} />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 7: MRKO & Invoice */}
                <TabsContent value="mrko" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>MRKO & Invoicing</CardTitle>
                            <CardDescription>
                                Tracking status MRKO dan integrasi nomor invoice SAP.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-3 pb-4 pt-0 sm:px-6 sm:pb-6">
                            <EvhsMrkoTable />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 8: Master Data Price */}
                <TabsContent value="master-price" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Master Price PT. CK</CardTitle>
                            <CardDescription>
                                Pengaturan harga khusus Cipta Kridatama untuk kalkulasi GI Matching.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="px-3 pb-4 pt-0 sm:px-6 sm:pb-6">
                            <EvhsMasterPriceTable warehouses={warehouses} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
