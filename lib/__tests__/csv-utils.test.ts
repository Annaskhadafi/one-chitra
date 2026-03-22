/**
 * Unit tests for CSV upload and validation utilities
 * Tests Requirement 4.3: CSV parser and validation
 */

import { describe, it, expect } from "vitest";
import {
  validateCommaSeparatedMaterials,
  generateCSVTemplate,
  parseAndValidateCSV,
} from "../csv-utils";

describe("CSV Utils - validateCommaSeparatedMaterials", () => {
  it("should validate valid comma-separated material numbers", () => {
    const input = "MAT001, MAT002, MAT003";
    const result = validateCommaSeparatedMaterials(input);

    expect(result.isValid).toBe(true);
    expect(result.materialNumbers).toEqual(["MAT001", "MAT002", "MAT003"]);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle empty input", () => {
    const result = validateCommaSeparatedMaterials("");

    expect(result.isValid).toBe(false);
    expect(result.materialNumbers).toHaveLength(0);
    expect(result.errors).toContain("Please enter material numbers");
  });

  it("should handle whitespace-only input", () => {
    const result = validateCommaSeparatedMaterials("   ");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Please enter material numbers");
  });

  it("should trim whitespace from material numbers", () => {
    const input = "  MAT001  ,  MAT002  ,  MAT003  ";
    const result = validateCommaSeparatedMaterials(input);

    expect(result.isValid).toBe(true);
    expect(result.materialNumbers).toEqual(["MAT001", "MAT002", "MAT003"]);
  });

  it("should detect duplicate material numbers", () => {
    const input = "MAT001, MAT002, MAT001, MAT003";
    const result = validateCommaSeparatedMaterials(input);

    expect(result.isValid).toBe(true);
    expect(result.materialNumbers).toEqual(["MAT001", "MAT002", "MAT003"]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("Duplicate");
  });

  it("should enforce maximum count limit", () => {
    const materials = Array.from({ length: 51 }, (_, i) => `MAT${i + 1}`);
    const input = materials.join(", ");
    const result = validateCommaSeparatedMaterials(input, 50);

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain("Maximum 50");
  });

  it("should handle single material number", () => {
    const result = validateCommaSeparatedMaterials("MAT001");

    expect(result.isValid).toBe(true);
    expect(result.materialNumbers).toEqual(["MAT001"]);
  });

  it("should filter out empty entries between commas", () => {
    const input = "MAT001,,MAT002,,,MAT003";
    const result = validateCommaSeparatedMaterials(input);

    expect(result.isValid).toBe(true);
    expect(result.materialNumbers).toEqual(["MAT001", "MAT002", "MAT003"]);
  });

  it("should generate preview with first 10 items", () => {
    const materials = Array.from({ length: 20 }, (_, i) => `MAT${i + 1}`);
    const input = materials.join(", ");
    const result = validateCommaSeparatedMaterials(input);

    expect(result.preview).toHaveLength(10);
    expect(result.preview[0]).toEqual({ materialNo: "MAT1", rowNumber: 1 });
  });
});

describe("CSV Utils - generateCSVTemplate", () => {
  it("should generate valid CSV template", () => {
    const template = generateCSVTemplate();

    expect(template).toContain("material_number");
    expect(template).toContain("description");
    expect(template).toContain("MAT001");
    expect(template).toContain("Sample Material 1");
  });

  it("should have proper CSV format with newlines", () => {
    const template = generateCSVTemplate();
    const lines = template.split("\n");

    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0]).toContain("material_number,description");
  });
});

describe("CSV Utils - parseAndValidateCSV", () => {
  // Note: These tests validate the file validation logic only
  // Full CSV parsing tests require browser environment with FileReader API
  
  it("should reject non-CSV files", async () => {
    const file = new File(["test"], "test.txt", { type: "text/plain" });
    const result = await parseAndValidateCSV(file);

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain("must be a CSV file");
  });

  it("should reject files larger than 5MB", async () => {
    // Create a large file (6MB)
    const largeContent = "a".repeat(6 * 1024 * 1024);
    const file = new File([largeContent], "large.csv", { type: "text/csv" });
    const result = await parseAndValidateCSV(file);

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain("less than 5MB");
  });

  // The following tests would require browser environment with FileReader
  // They are skipped in Node.js test environment
  // CSV parsing functionality will be tested in browser/component tests
});
