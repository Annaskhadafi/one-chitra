import { AlertCircle, PackageCheck, ChevronRight } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ReadyOutstandingSalesOrder } from "@/app/actions/delivery"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"

export function OutstandingReminder({ orders }: { orders: ReadyOutstandingSalesOrder[] }) {
    if (!orders || orders.length === 0) return null

    const getWarehouseBadgeLabel = (order: ReadyOutstandingSalesOrder) => {
        if (order.warehouseId) {
            return `Warehouse #${order.warehouseId}`
        }

        return "-"
    }

    return (
        <div className="flex flex-col gap-2 mb-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <h3 className="text-[13px] font-semibold text-amber-700 dark:text-amber-500 flex items-center gap-1.5 mb-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Pengingat Outstanding (Bisa Dikirim)
            </h3>

            <div className="relative px-8 lg:px-10">
                <Carousel
                    opts={{
                        align: "start",
                        dragFree: true,
                    }}
                    className="w-full"
                >
                    <CarouselContent className="-ml-2 md:-ml-3">
                        {orders.map(order => (
                            <CarouselItem key={order.id} className="pl-2 md:pl-3 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                                <Alert className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 relative overflow-hidden shadow-sm h-full flex flex-col justify-between py-2.5 px-3">
                                    <div className="absolute top-0 right-0 w-1 h-full bg-amber-400 dark:bg-amber-500"></div>

                                    <div>
                                        <AlertTitle className="text-xs font-bold text-amber-900 dark:text-amber-400 flex items-center justify-between gap-2 m-0 p-0">
                                            <span className="truncate">{order.invoiceNumber}</span>
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-white dark:bg-black/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-500 shrink-0">
                                                {getWarehouseBadgeLabel(order)}
                                            </Badge>
                                        </AlertTitle>
                                        <AlertDescription className="mt-1 text-xs text-amber-700 dark:text-amber-600">
                                            <p className="font-semibold text-amber-800 dark:text-amber-300 text-[11px] truncate">{order.customer?.name}</p>
                                            
                                            <div className="flex flex-col gap-1 mt-2 p-1.5 rounded bg-white/60 dark:bg-black/20 border border-amber-100 dark:border-amber-900/40">
                                                {order.readyItems?.map((item, idx) => (
                                                    <div key={idx} className="flex items-center justify-between gap-2 border-b border-amber-100/50 dark:border-amber-900/40 pb-1 last:border-0 last:pb-0">
                                                        <div className="flex flex-col min-w-0 flex-1">
                                                            <span className="font-bold text-[10px] truncate text-slate-800 dark:text-slate-200">{item.product?.materialNumber}</span>
                                                            <span className="text-[9px] truncate opacity-80">{item.product?.materialDescription}</span>
                                                        </div>
                                                        <div className="flex flex-col items-end justify-center gap-0.5 shrink-0">
                                                            <span className="text-[9px] font-medium opacity-80 leading-none mt-0.5">Sisa {item.remainingQuantity}</span>
                                                            <Badge variant="outline" className="text-[9px] h-3.5 px-1 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-500 leading-none">
                                                                Ready {item.availableStock}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </AlertDescription>
                                    </div>

                                    <div className="pt-2.5 mt-2">
                                        <Link href={`/dashboard/deliveries/create?so=${order.id}`}>
                                            <Button variant="outline" size="sm" className="w-full text-[11px] h-7 bg-white dark:bg-zinc-950 border-amber-200 hover:border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900 hover:text-amber-900 font-bold shadow-sm group">
                                                <PackageCheck className="h-3.5 w-3.5 mr-1.5 text-green-600 dark:text-green-500 group-hover:scale-110 transition-transform" />
                                                Buat Delivery
                                                <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-50 transition-transform group-hover:translate-x-1" />
                                            </Button>
                                        </Link>
                                    </div>
                                </Alert>
                            </CarouselItem>
                        ))}
                    </CarouselContent>

                    {orders.length > 2 && (
                        <>
                            <CarouselPrevious className="left-[-2rem] lg:left-[-2.5rem] border-amber-200 text-amber-700 hover:bg-amber-100 h-7 w-7 bg-amber-50" />
                            <CarouselNext className="right-[-2rem] lg:right-[-2.5rem] border-amber-200 text-amber-700 hover:bg-amber-100 h-7 w-7 bg-amber-50" />
                        </>
                    )}
                </Carousel>
            </div>
        </div>
    )
}
