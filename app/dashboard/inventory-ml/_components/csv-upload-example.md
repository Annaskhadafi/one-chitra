# CSV Upload Component Usage

This document demonstrates how to use the CSV upload component for bulk predictions.

## Component: CSVUpload

The `CSVUpload` component provides a user-friendly interface for uploading CSV files containing material numbers for bulk predictions.

### Features

- ✅ CSV file validation (format, size, required columns)
- ✅ Preview of parsed data (first 10 items)
- ✅ Error and warning messages
- ✅ Download CSV template
- ✅ Maximum row limit enforcement (default: 50)
- ✅ Duplicate detection
- ✅ Empty row handling

### Props

```typescript
interface CSVUploadProps {
  onMaterialsExtracted: (materialNumbers: string[]) => void;
  maxRows?: number; // Default: 50
  disabled?: boolean; // Default: false
}
```

### Usage Example

```tsx
import { CSVUpload } from "@/app/dashboard/inventory-ml/_components/csv-upload";

function BulkPredictionDialog() {
  const [materialNumbers, setMaterialNumbers] = useState<string[]>([]);

  const handleMaterialsExtracted = (materials: string[]) => {
    setMaterialNumbers(materials);
    console.log(`Extracted ${materials.length} material numbers:`, materials);
  };

  return (
    <div>
      <CSVUpload
        onMaterialsExtracted={handleMaterialsExtracted}
        maxRows={50}
        disabled={false}
      />
      
      {materialNumbers.length > 0 && (
        <div>
          <p>Ready to process {materialNumbers.length} materials</p>
          <button onClick={() => processBulkPredictions(materialNumbers)}>
            Start Bulk Prediction
          </button>
        </div>
      )}
    </div>
  );
}
```

### CSV File Format

The CSV file must contain a column named `material_number` (case-insensitive). Additional columns are optional.

**Example CSV:**

```csv
material_number,description
MAT001,Product 1
MAT002,Product 2
MAT003,Product 3
```

**Alternative column names (automatically normalized):**

- `Material_Number`
- `MATERIAL_NUMBER`
- `material number` (spaces converted to underscores)

### Validation Rules

1. **File Type**: Must be a `.csv` file
2. **File Size**: Maximum 5MB
3. **Required Column**: Must have `material_number` column
4. **Max Rows**: Configurable (default: 50 rows)
5. **Empty Rows**: Automatically skipped with warning
6. **Duplicates**: Detected and skipped with warning

### Error Handling

The component displays three types of messages:

1. **Errors** (red): Critical issues that prevent processing
   - Invalid file type
   - File too large
   - Missing required column
   - Empty file

2. **Warnings** (yellow): Non-critical issues
   - Duplicate material numbers
   - Empty rows
   - Exceeding max rows (only first N processed)

3. **Success** (green): Successful validation
   - Shows count of extracted materials
   - Displays preview of first 10 items

### Download Template

Users can download a sample CSV template by clicking the "Download Template" button. The template includes:

- Proper column headers
- Sample data rows
- Correct formatting

### Integration with Bulk Prediction

The component is designed to work seamlessly with the `processBulkPredictions` server action:

```tsx
import { processBulkPredictions } from "@/app/actions/inventory-ml";

async function handleBulkPrediction(
  materialNumbers: string[],
  predictionType: 'REPLENISHMENT' | 'SAFETY_STOCK'
) {
  const result = await processBulkPredictions(materialNumbers, predictionType);
  
  if (result.success) {
    console.log(`Processed ${result.summary.successful} predictions`);
    console.log(`Failed: ${result.summary.failed}`);
    console.log(`From cache: ${result.summary.cached}`);
  }
}
```

## Utility Functions

The component uses utility functions from `lib/csv-utils.ts`:

### parseAndValidateCSV

Parses and validates a CSV file.

```typescript
const result = await parseAndValidateCSV(file, { maxRows: 50 });

if (result.isValid) {
  console.log(result.materialNumbers); // Array of material numbers
  console.log(result.preview); // First 10 items with row numbers
}
```

### validateCommaSeparatedMaterials

Validates comma-separated material numbers (alternative to CSV upload).

```typescript
const result = validateCommaSeparatedMaterials("MAT001, MAT002, MAT003", 50);

if (result.isValid) {
  console.log(result.materialNumbers); // ["MAT001", "MAT002", "MAT003"]
}
```

### downloadCSVTemplate

Downloads a sample CSV template file.

```typescript
downloadCSVTemplate(); // Downloads "bulk_prediction_template.csv"
```

## Testing

Unit tests are available in `lib/__tests__/csv-utils.test.ts` covering:

- ✅ Comma-separated validation
- ✅ CSV template generation
- ✅ File type validation
- ✅ File size validation
- ✅ Duplicate detection
- ✅ Empty input handling
- ✅ Max rows enforcement

Run tests with:

```bash
npm test -- lib/__tests__/csv-utils.test.ts --run
```

## Requirements Fulfilled

This implementation satisfies **Requirement 4.3**:

- ✅ Implement CSV parser in client component
- ✅ Validate CSV format (material number column required)
- ✅ Show preview of parsed data
