"use client";

/**
 * CSV Upload Component for Bulk Predictions
 * Requirement 4.3: CSV parser and validation for bulk predictions
 */

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Download, AlertCircle, CheckCircle2, X } from "lucide-react";
import {
  parseAndValidateCSV,
  downloadCSVTemplate,
  type CSVValidationResult,
} from "@/lib/csv-utils";

interface CSVUploadProps {
  onMaterialsExtracted: (materialNumbers: string[]) => void;
  maxRows?: number;
  disabled?: boolean;
}

export function CSVUpload({ onMaterialsExtracted, maxRows = 50, disabled = false }: CSVUploadProps) {
  const [validationResult, setValidationResult] = useState<CSVValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFileName(file.name);

    try {
      const result = await parseAndValidateCSV(file, { maxRows });
      setValidationResult(result);

      // If valid, automatically extract materials
      if (result.isValid && result.materialNumbers.length > 0) {
        onMaterialsExtracted(result.materialNumbers);
      }
    } catch (error) {
      setValidationResult({
        isValid: false,
        materialNumbers: [],
        errors: [error instanceof Error ? error.message : "Failed to process CSV file"],
        warnings: [],
        preview: [],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setValidationResult(null);
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onMaterialsExtracted([]);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* File Input (Hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isProcessing}
      />

      {/* Upload Area */}
      {!validationResult && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center space-y-4">
          <div className="flex justify-center">
            <Upload className="h-12 w-12 text-gray-400" />
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Upload a CSV file with material numbers
            </p>
            <p className="text-xs text-gray-500">
              Maximum {maxRows} rows, 5MB file size limit
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              onClick={handleBrowseClick}
              disabled={disabled || isProcessing}
              variant="outline"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isProcessing ? "Processing..." : "Browse Files"}
            </Button>
            <Button
              type="button"
              onClick={downloadCSVTemplate}
              variant="ghost"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>
        </div>
      )}

      {/* Validation Results */}
      {validationResult && (
        <div className="space-y-3">
          {/* File Info */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-500" />
              <span className="text-sm font-medium">{fileName}</span>
            </div>
            <Button
              type="button"
              onClick={handleClear}
              variant="ghost"
              size="sm"
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Success Message */}
          {validationResult.isValid && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Successfully extracted {validationResult.materialNumbers.length} material number(s)
              </AlertDescription>
            </Alert>
          )}

          {/* Errors */}
          {validationResult.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {validationResult.errors.map((error, index) => (
                    <div key={index} className="text-sm">
                      {error}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Warnings */}
          {validationResult.warnings.length > 0 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <div className="space-y-1">
                  <div className="font-medium text-sm mb-1">Warnings:</div>
                  {validationResult.warnings.slice(0, 5).map((warning, index) => (
                    <div key={index} className="text-xs">
                      • {warning}
                    </div>
                  ))}
                  {validationResult.warnings.length > 5 && (
                    <div className="text-xs italic">
                      ... and {validationResult.warnings.length - 5} more warning(s)
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {validationResult.isValid && validationResult.preview.length > 0 && (
            <div className="border rounded-lg p-3">
              <div className="text-sm font-medium mb-2">Preview (first 10 items):</div>
              <div className="space-y-1">
                {validationResult.preview.map((item, index) => (
                  <div
                    key={index}
                    className="text-xs font-mono bg-gray-50 px-2 py-1 rounded"
                  >
                    {item.materialNo}
                  </div>
                ))}
                {validationResult.materialNumbers.length > 10 && (
                  <div className="text-xs text-gray-500 italic pt-1">
                    ... and {validationResult.materialNumbers.length - 10} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
