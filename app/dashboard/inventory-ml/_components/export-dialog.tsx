"use client";

/**
 * Export Dialog Component
 * Provides UI for exporting MAGIC predictions to Excel or PDF formats
 * Requirements: 5.1, 5.2, 5.9, 5.10
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Download, FileSpreadsheet, FileText, Calendar as CalendarIcon, AlertCircle } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/app/actions/inventory-ml";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = "excel" | "pdf";
type PredictionType = "ALL" | "REPLENISHMENT" | "SAFETY_STOCK" | "CUSTOMER_RECOMMENDATION";

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  // State management
  const [exportFormat, setExportFormat] = useState<ExportFormat>("excel");
  const [predictionType, setPredictionType] = useState<PredictionType>("ALL");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [isExporting, setIsExporting] = useState(false);

  // Handle export action
  const handleExport = async () => {
    setIsExporting(true);

    try {
      // Prepare filter parameters
      const filters = {
        dateFrom,
        dateTo,
        predictionType,
      };

      // Call appropriate export function based on format
      const result = exportFormat === "excel"
        ? await exportToExcel(filters)
        : await exportToPDF(filters);

      if (result.success && result.data) {
        // Convert base64 buffer to blob and trigger download
        const { buffer, filename, mimeType } = result.data;

        // Decode base64 to binary
        const binaryString = atob(buffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Create blob and download
        const blob = new Blob([bytes], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success(`Export completed: ${filename}`);

        // Close dialog after successful export
        onOpenChange(false);

        // Reset form
        resetForm();
      } else {
        toast.error(result.error || "Failed to export data");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("An error occurred during export");
    } finally {
      setIsExporting(false);
    }
  };

  // Reset form to initial state
  const resetForm = () => {
    setExportFormat("excel");
    setPredictionType("ALL");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  // Handle dialog close
  const handleClose = () => {
    if (!isExporting) {
      resetForm();
      onOpenChange(false);
    }
  };

  // Validate date range
  const isDateRangeValid = () => {
    if (dateFrom && dateTo) {
      return dateFrom <= dateTo;
    }
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export MAGIC Predictions</DialogTitle>
          <DialogDescription>
            Export prediction data to Excel or PDF format with optional filters
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Format Selection */}
          <div className="space-y-2">
            <Label htmlFor="exportFormat">Export Format</Label>
            <Select
              value={exportFormat}
              onValueChange={(value) => setExportFormat(value as ExportFormat)}
              disabled={isExporting}
            >
              <SelectTrigger id="exportFormat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    <span>Excel (.xlsx)</span>
                  </div>
                </SelectItem>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-red-600" />
                    <span>PDF (.pdf)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Prediction Type Filter */}
          <div className="space-y-2">
            <Label htmlFor="predictionType">Prediction Type</Label>
            <Select
              value={predictionType}
              onValueChange={(value) => setPredictionType(value as PredictionType)}
              disabled={isExporting}
            >
              <SelectTrigger id="predictionType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="REPLENISHMENT">Predictive Replenishment</SelectItem>
                <SelectItem value="SAFETY_STOCK">Dynamic Safety Stock</SelectItem>
                <SelectItem value="CUSTOMER_RECOMMENDATION">Customer Recommendations</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filter */}
          <div className="space-y-2">
            <Label>Date Range (Optional)</Label>
            <div className="grid grid-cols-2 gap-4">
              {/* From Date */}
              <div className="space-y-2">
                <Label htmlFor="dateFrom" className="text-xs text-muted-foreground">
                  From
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="dateFrom"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                      disabled={isExporting}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* To Date */}
              <div className="space-y-2">
                <Label htmlFor="dateTo" className="text-xs text-muted-foreground">
                  To
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="dateTo"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                      disabled={isExporting}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Clear Date Range Button */}
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFrom(undefined);
                  setDateTo(undefined);
                }}
                disabled={isExporting}
                className="text-xs"
              >
                Clear date range
              </Button>
            )}
          </div>

          {/* Validation Messages */}
          {!isDateRangeValid() && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                &quot;From&quot; date must be before or equal to &quot;To&quot; date
              </AlertDescription>
            </Alert>
          )}

          {/* Loading Indicator */}
          {isExporting && (
            <Alert className="border-blue-200 bg-blue-50">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <AlertDescription className="text-blue-800">
                Generating {exportFormat === "excel" ? "Excel" : "PDF"} file... Please wait.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || !isDateRangeValid()}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
