/**
 * CSV Upload and Validation Utilities for AI Inventory Forecast
 * Requirement 4.3: CSV parser and validation for bulk predictions
 */

import Papa from "papaparse";

export interface CSVValidationResult {
  isValid: boolean;
  materialNumbers: string[];
  errors: string[];
  warnings: string[];
  preview: Array<{ materialNo: string; rowNumber: number }>;
}

export interface CSVParseOptions {
  maxRows?: number;
  requiredColumn?: string;
}

/**
 * Parse and validate CSV file for bulk predictions
 * @param file - CSV file to parse
 * @param options - Parsing options
 * @returns Validation result with material numbers and errors
 */
export async function parseAndValidateCSV(
  file: File,
  options: CSVParseOptions = {}
): Promise<CSVValidationResult> {
  const { maxRows = 50, requiredColumn = "material_number" } = options;

  return new Promise((resolve) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const materialNumbers: string[] = [];
    const preview: Array<{ materialNo: string; rowNumber: number }> = [];

    // Validate file type
    if (!file.name.toLowerCase().endsWith(".csv")) {
      resolve({
        isValid: false,
        materialNumbers: [],
        errors: ["File must be a CSV file"],
        warnings: [],
        preview: [],
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      resolve({
        isValid: false,
        materialNumbers: [],
        errors: ["File size must be less than 5MB"],
        warnings: [],
        preview: [],
      });
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => {
        // Check if required column exists
        const headers = results.meta.fields || [];
        const hasRequiredColumn = headers.some(
          (h) => h.toLowerCase() === requiredColumn.toLowerCase()
        );

        if (!hasRequiredColumn) {
          errors.push(
            `Required column "${requiredColumn}" not found. Available columns: ${headers.join(", ")}`
          );
          resolve({
            isValid: false,
            materialNumbers: [],
            errors,
            warnings,
            preview: [],
          });
          return;
        }

        // Extract material numbers
        const data = results.data as Array<Record<string, unknown>>;

        if (data.length === 0) {
          errors.push("CSV file is empty");
          resolve({
            isValid: false,
            materialNumbers: [],
            errors,
            warnings,
            preview: [],
          });
          return;
        }

        // Check max rows limit
        if (data.length > maxRows) {
          warnings.push(
            `CSV contains ${data.length} rows, but only the first ${maxRows} will be processed`
          );
        }

        // Process rows
        const processedRows = data.slice(0, maxRows);
        const seenMaterials = new Set<string>();

        processedRows.forEach((row, index) => {
          const materialNo = String(row[requiredColumn] || "").trim();

          if (!materialNo) {
            warnings.push(`Row ${index + 2}: Empty material number, skipping`);
            return;
          }

          // Check for duplicates
          if (seenMaterials.has(materialNo)) {
            warnings.push(`Row ${index + 2}: Duplicate material number "${materialNo}", skipping`);
            return;
          }

          seenMaterials.add(materialNo);
          materialNumbers.push(materialNo);
          
          // Add to preview (first 10 items)
          if (preview.length < 10) {
            preview.push({
              materialNo,
              rowNumber: index + 2, // +2 because of header and 0-index
            });
          }
        });

        // Final validation
        if (materialNumbers.length === 0) {
          errors.push("No valid material numbers found in CSV");
          resolve({
            isValid: false,
            materialNumbers: [],
            errors,
            warnings,
            preview: [],
          });
          return;
        }

        resolve({
          isValid: true,
          materialNumbers,
          errors,
          warnings,
          preview,
        });
      },
      error: (error) => {
        resolve({
          isValid: false,
          materialNumbers: [],
          errors: [`Failed to parse CSV: ${error.message}`],
          warnings: [],
          preview: [],
        });
      },
    });
  });
}

/**
 * Validate comma-separated material numbers
 * @param input - Comma-separated string of material numbers
 * @param maxCount - Maximum number of material numbers allowed
 * @returns Validation result
 */
export function validateCommaSeparatedMaterials(
  input: string,
  maxCount: number = 50
): CSVValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const materialNumbers: string[] = [];
  const preview: Array<{ materialNo: string; rowNumber: number }> = [];

  if (!input || input.trim().length === 0) {
    errors.push("Please enter material numbers");
    return {
      isValid: false,
      materialNumbers: [],
      errors,
      warnings,
      preview: [],
    };
  }

  // Split by comma and clean up
  const items = input
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (items.length === 0) {
    errors.push("No valid material numbers found");
    return {
      isValid: false,
      materialNumbers: [],
      errors,
      warnings,
      preview: [],
    };
  }

  if (items.length > maxCount) {
    errors.push(`Maximum ${maxCount} material numbers allowed, found ${items.length}`);
    return {
      isValid: false,
      materialNumbers: [],
      errors,
      warnings,
      preview: [],
    };
  }

  // Check for duplicates
  const seenMaterials = new Set<string>();
  items.forEach((item, index) => {
    if (seenMaterials.has(item)) {
      warnings.push(`Duplicate material number "${item}" at position ${index + 1}, skipping`);
      return;
    }

    seenMaterials.add(item);
    materialNumbers.push(item);

    // Add to preview (first 10 items)
    if (preview.length < 10) {
      preview.push({
        materialNo: item,
        rowNumber: index + 1,
      });
    }
  });

  return {
    isValid: true,
    materialNumbers,
    errors,
    warnings,
    preview,
  };
}

/**
 * Generate a sample CSV template for download
 * @returns CSV content as string
 */
export function generateCSVTemplate(): string {
  const headers = ["material_number", "description"];
  const sampleRows = [
    ["MAT001", "Sample Material 1"],
    ["MAT002", "Sample Material 2"],
    ["MAT003", "Sample Material 3"],
  ];

  const csvContent = [
    headers.join(","),
    ...sampleRows.map((row) => row.join(",")),
  ].join("\n");

  return csvContent;
}

/**
 * Download CSV template file
 */
export function downloadCSVTemplate(): void {
  const csvContent = generateCSVTemplate();
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "bulk_prediction_template.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
