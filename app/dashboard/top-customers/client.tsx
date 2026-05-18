"use client"

import { useState } from "react"
import { format } from "date-fns"
import { DateRange } from "react-day-picker"
import { useQuery } from "@tanstack/react-query"
import { getTopCustomersThisYear } from "@/app/actions/top-customers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn, formatCurrency } from "@/lib/utils"
import { Loader2, TrendingUp, AlertCircle, CheckCircle2, Box, Calendar as CalendarIcon, X, Users, PackageOpen } from "lucide-react"

export function TopCustomersClient() {
  const [year, setYear] = useState<string>(new Date().getFullYear().toString())
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  const { data, isLoading, isError } = useQuery({
    queryKey: ["top-customers-revenue", year, dateRange],
    queryFn: () => getTopCustomersThisYear({ year, from: dateRange?.from, to: dateRange?.to }),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Memuat data revenue SAP...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4 text-destructive">
        <AlertCircle className="w-8 h-8" />
        <p>Gagal memuat data pelanggan.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Tahun:</span>
          <Select value={year} onValueChange={(val) => { setYear(val); setDateRange(undefined); }}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Pilih Tahun" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }).map((_, i) => {
                const y = new Date().getFullYear() - i;
                return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden sm:block text-muted-foreground">atau</div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-[260px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "dd MMM yyyy")} -{" "}
                      {format(dateRange.to, "dd MMM yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "dd MMM yyyy")
                  )
                ) : (
                  <span>Pilih rentang tanggal (Opsional)</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          {dateRange && (
            <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {!data?.customers || data.customers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 space-y-4">
            <Box className="w-8 h-8 text-muted-foreground" />
            <p className="text-muted-foreground">Tidak ada data revenue untuk filter ini.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="customers" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              15 Customer Teratas
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <PackageOpen className="w-4 h-4" />
              15 Produk Teratas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers" className="grid gap-6">
            {data.customers.map((customer, index) => (
              <Card key={customer.customerName || index} className="overflow-hidden border-t-4 border-t-primary">
          <CardHeader className="bg-muted/50 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {index + 1}
                  </span>
                  {customer.customerName}
                </CardTitle>
                <CardDescription className="mt-1">
                  Total Revenue {dateRange?.from ? "di Rentang Tanggal Ini" : `Tahun ${year}`}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary flex items-center gap-2 justify-end">
                  <TrendingUp className="w-5 h-5" />
                  {formatCurrency(customer.totalRevenue)}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[350px] overflow-auto scrollbar-thin scrollbar-thumb-accent">
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-[150px]">Material No</TableHead>
                    <TableHead>Deskripsi Material</TableHead>
                    <TableHead className="text-right w-[100px]">Qty Dibeli</TableHead>
                    <TableHead className="text-right w-[180px]">Revenue DO Curr</TableHead>
                    <TableHead className="text-right w-[150px]">Status Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.topItems.map((item, idx) => (
                    <TableRow key={`${item.materialNo}-${idx}`}>
                      <TableCell className="font-mono text-xs">{item.materialNo}</TableCell>
                      <TableCell className="font-medium">{item.materialDescription}</TableCell>
                      <TableCell className="text-right font-semibold">{item.qty}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatCurrency(item.itemRevenue || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.isReady ? (
                          <div className="flex items-center justify-end gap-2 text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="font-bold">Ready</span>
                          </div>
                        ) : item.currentStock > 0 ? (
                          <div className="flex items-center justify-end gap-2 text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="font-bold">{item.currentStock}</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2 text-destructive">
                            <AlertCircle className="w-4 h-4" />
                            <span className="font-bold">Kosong</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {customer.topItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        Tidak ada detail barang
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        ))}
      </TabsContent>

      <TabsContent value="products">
            <Card className="overflow-hidden border-t-4 border-t-primary">
              <CardHeader className="bg-muted/50 pb-4">
                <CardTitle className="text-xl">15 Produk Teratas</CardTitle>
                <CardDescription>
                  Produk dengan revenue tertinggi secara keseluruhan dari 15 customer teratas {dateRange?.from ? "di rentang tanggal ini" : `tahun ${year}`}.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto scrollbar-thin scrollbar-thumb-accent">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-[150px]">Material No</TableHead>
                        <TableHead>Deskripsi Material</TableHead>
                        <TableHead className="text-right w-[100px]">Total Qty</TableHead>
                        <TableHead className="text-right w-[180px]">Total Revenue DO Curr</TableHead>
                        <TableHead className="text-right w-[150px]">Status Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topProducts?.map((item, idx) => (
                        <TableRow key={`${item.materialNo}-${idx}`}>
                          <TableCell className="font-mono text-xs">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                {idx + 1}
                              </span>
                              {item.materialNo}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{item.materialDescription}</TableCell>
                          <TableCell className="text-right font-semibold">{item.qty}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            {formatCurrency(item.itemRevenue || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.isReady ? (
                              <div className="flex items-center justify-end gap-2 text-emerald-600">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="font-bold">Ready</span>
                              </div>
                            ) : item.currentStock > 0 ? (
                              <div className="flex items-center justify-end gap-2 text-emerald-600">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="font-bold">{item.currentStock}</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2 text-destructive">
                                <AlertCircle className="w-4 h-4" />
                                <span className="font-bold">Kosong</span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!data.topProducts?.length && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                            Tidak ada data produk
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
