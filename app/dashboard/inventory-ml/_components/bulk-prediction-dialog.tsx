"use client";

/**
 * Bulk Prediction Dialog Component
 * Allows users to process predictions for multiple products at once
 * Requirements: 4.1, 4.5, 4.9, 4.10
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
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Download,
  AlertCircle,
  Clock,
} from "lucide-react";
import { CSVUpload } from "./csv-upload";
import { processBulkPredictions } from "@/app/actions/inventory-ml";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface BulkPredictionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  predictionType: "REPLENISHMENT" | "SAFETY_STOCK";
  onComplete?: () => void;
}

interface ProcessingState {
  isProcessing: boolean;
  currentIndex: number;
  currentMaterial: string;
  totalCount: number;
  results: Array<{
    materialNo: string;
    status: "success" | "failed" | "cached";
    predictionId?: number;
    error?: string;
  }>;
}

export function BulkPredictionDialog({
  open,
  onOpenChange,
  predictionType,
  onComplete,
}: BulkPredictionDialogProps) {
  const [materialInput, setMaterialInput] = useState("");
  const [materialNumbers, setMaterialNumbers] = useState<string[]>([]);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    currentIndex: 0,
    currentMaterial: "",
    totalCount: 0,
    results: [],
  });
  const [showSummary, setShowSummary] = useState(false);

  // Handle manual input of comma-separated material numbers
  const handleMaterialInputChange = (value: string) => {
    setMaterialInput(value);

    // Parse comma-separated values
    const materials = value
      .split(",")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    setMaterialNumbers(materials);
  };

  // Handle CSV upload
  const handleCSVMaterialsExtracted = (materials: string[]) => {
    setMaterialNumbers(materials);
    setMaterialInput(""); // Clear manual input when CSV is uploaded
  };

  // Process bulk predictions
  const handleStartProcessing = async () => {
    if (materialNumbers.length === 0) {
      toast.error("Please enter material numbers or upload a CSV file");
      return;
    }

    if (materialNumbers.length > 50) {
      toast.error("Maximum 50 products allowed per batch");
      return;
    }

    setProcessingState({
      isProcessing: true,
      currentIndex: 0,
      currentMaterial: materialNumbers[0],
      totalCount: materialNumbers.length,
      results: [],
    });
    setShowSummary(false);

    try {
      const result = await processBulkPredictions(materialNumbers, predictionType);

      if (result.success) {
        setProcessingState((prev) => ({
          ...prev,
          isProcessing: false,
          currentIndex: materialNumbers.length,
          results: result.results || [],
        }));
        setShowSummary(true);
        if (result.summary) {
          toast.success(
            `Bulk prediction completed: ${result.summary.successful} successful, ${result.summary.failed} failed, ${result.summary.cached} from cache`
          );
        } else {
          toast.success("Bulk prediction completed");
        }

        if (onComplete) {
          onComplete();
        }
      } else {
        toast.error(result.error || "Failed to process bulk predictions");
        setProcessingState((prev) => ({
          ...prev,
          isProcessing: false,
        }));
      }
    } catch (error) {
      console.error("Bulk prediction error:", error);
      toast.error("An error occurred during bulk prediction");
      setProcessingState((prev) => ({
        ...prev,
        isProcessing: false,
      }));
    }
  };

  // Download results as Excel
  const handleDownloadResults = () => {
    if (processingState.results.length === 0) {
      toast.error("No results to download");
      return;
    }

    try {
      // Prepare data for Excel
      const excelData = processingState.results.map((result) => ({
        "Material Number": result.materialNo,
        Status: result.status.toUpperCase(),
        "Prediction ID": result.predictionId || "N/A",
        Error: result.error || "",
      }));

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Bulk Prediction Results");

      // Generate filename
      const timestamp = new Date().toISOString().split("T")[0];
      const typeLabel = predictionType === "REPLENISHMENT" ? "Replenishment" : "SafetyStock";
      const filename = `Bulk_Prediction_${typeLabel}_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);
      toast.success("Results downloaded successfully");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download results");
    }
  };

  // Reset dialog state
  const handleClose = () => {
    if (!processingState.isProcessing) {
      setMaterialInput("");
      setMaterialNumbers([]);
      setProcessingState({
        isProcessing: false,
        currentIndex: 0,
        currentMaterial: "",
        totalCount: 0,
        results: [],
      });
      setShowSummary(false);
      onOpenChange(false);
    }
  };

  // Calculate progress percentage
  const progressPercentage =
    processingState.totalCount > 0
      ? (processingState.currentIndex / processingState.totalCount) * 100
      : 0;

  // Calculate summary statistics
  const successCount = processingState.results.filter((r) => r.status === "success").length;
  const failedCount = processingState.results.filter((r) => r.status === "failed").length;
  const cachedCount = processingState.results.filter((r) => r.status === "cached").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Bulk Prediction - {predictionType === "REPLENISHMENT" ? "Replenishment" : "Safety Stock"}
          </DialogTitle>
          <DialogDescription>
            Process predictions for multiple products at once (max 50 products)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Input Section - Hidden during processing */}
          {!processingState.isProcessing && !showSummary && (
            <>
              {/* Manual Input */}
              <div className="space-y-2">
                <Label htmlFor="materialInput">
                  Material Numbers (comma-separated)
                </Label>
                <Textarea
                  id="materialInput"
                  placeholder="Enter material numbers separated by commas, e.g., MAT001, MAT002, MAT003"
                  value={materialInput}
                  onChange={(e) => handleMaterialInputChange(e.target.value)}
                  rows={4}
                  disabled={materialNumbers.length > 0 && materialInput === ""}
                />
                {materialNumbers.length > 0 && materialInput !== "" && (
                  <p className="text-sm text-muted-foreground">
                    {materialNumbers.length} material(s) detected
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or upload CSV
                  </span>
                </div>
              </div>

              {/* CSV Upload */}
              <CSVUpload
                onMaterialsExtracted={handleCSVMaterialsExtracted}
                maxRows={50}
                disabled={materialInput.length > 0}
              />

              {/* Validation Messages */}
              {materialNumbers.length > 50 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Maximum 50 products allowed. Currently: {materialNumbers.length}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Processing Section */}
          {processingState.isProcessing && (
            <div className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Processing predictions... Please do not close this dialog.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Processing: {processingState.currentMaterial}
                  </span>
                  <span className="font-medium">
                    {processingState.currentIndex} / {processingState.totalCount}
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-3" />
                <p className="text-xs text-muted-foreground text-center">
                  {Math.round(progressPercentage)}% complete
                </p>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Processing with 2-second delay between requests</p>
                <p>• Using cached data when available (less than 24 hours old)</p>
                <p>• Estimated time: ~{Math.ceil(processingState.totalCount * 2 / 60)} minutes</p>
              </div>
            </div>
          )}

          {/* Summary Section */}
          {showSummary && (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Bulk prediction completed successfully!
                </AlertDescription>
              </Alert>

              {/* Summary Statistics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="border rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-2xl font-bold">{successCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Successful</p>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-2xl font-bold">{cachedCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">From Cache</p>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                    <XCircle className="h-4 w-4" />
                    <span className="text-2xl font-bold">{failedCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>

              {/* Failed Items Details */}
              {failedCount > 0 && (
                <div className="border rounded-lg p-3 max-h-[200px] overflow-y-auto">
                  <p className="text-sm font-medium mb-2">Failed Items:</p>
                  <div className="space-y-1">
                    {processingState.results
                      .filter((r) => r.status === "failed")
                      .map((result, index) => (
                        <div
                          key={index}
                          className="text-xs bg-red-50 border border-red-200 rounded p-2"
                        >
                          <span className="font-medium">{result.materialNo}</span>
                          {result.error && (
                            <span className="text-red-600 ml-2">- {result.error}</span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Download Button */}
              <Button
                onClick={handleDownloadResults}
                variant="outline"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Results as Excel
              </Button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            {!processingState.isProcessing && !showSummary && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleStartProcessing}
                  disabled={materialNumbers.length === 0 || materialNumbers.length > 50}
                >
                  Start Processing ({materialNumbers.length} items)
                </Button>
              </>
            )}

            {showSummary && (
              <Button onClick={handleClose}>Close</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
