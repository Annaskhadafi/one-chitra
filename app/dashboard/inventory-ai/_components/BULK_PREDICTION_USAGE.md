# BulkPredictionDialog Usage Guide

## Overview

The `BulkPredictionDialog` component provides a user interface for processing predictions for multiple products at once. It integrates with the `processBulkPredictions` server action and the `CSVUpload` component.

## Features

- ✅ Manual input for comma-separated material numbers
- ✅ CSV file upload option
- ✅ Real-time progress bar showing current product being processed
- ✅ Summary report on completion with success/failed/cached counts
- ✅ Download results as Excel button
- ✅ Maximum 50 products per batch validation
- ✅ 2-second delay between requests to avoid rate limiting
- ✅ Cache utilization for recent predictions (< 24 hours)

## Integration Example

### Step 1: Import the Component

```tsx
import { BulkPredictionDialog } from "./_components/bulk-prediction-dialog"
```

### Step 2: Add State Management

```tsx
function ReplenishmentTab() {
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  
  // ... existing code ...
  
  const handleBulkComplete = () => {
    // Refresh history after bulk processing
    loadHistory()
  }
  
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Generate Prediksi Restock
          </CardTitle>
          <CardDescription>
            Masukkan Material Number dari SAP untuk mendapatkan saran restock dari AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing single prediction form */}
          
          {/* Add Bulk Prediction Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={() => setShowBulkDialog(true)}
              variant="outline"
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Bulk Prediction (Multiple Products)
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Add Dialog Component */}
      <BulkPredictionDialog
        open={showBulkDialog}
        onOpenChange={setShowBulkDialog}
        predictionType="REPLENISHMENT"
        onComplete={handleBulkComplete}
      />
      
      {/* Existing history section */}
    </div>
  )
}
```

### Step 3: Similar Integration for SafetyStockTab

```tsx
function SafetyStockTab() {
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  
  // ... similar implementation with predictionType="SAFETY_STOCK" ...
  
  <BulkPredictionDialog
    open={showBulkDialog}
    onOpenChange={setShowBulkDialog}
    predictionType="SAFETY_STOCK"
    onComplete={handleBulkComplete}
  />
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | Yes | Controls dialog visibility |
| `onOpenChange` | `(open: boolean) => void` | Yes | Callback when dialog open state changes |
| `predictionType` | `"REPLENISHMENT" \| "SAFETY_STOCK"` | Yes | Type of prediction to process |
| `onComplete` | `() => void` | No | Callback when bulk processing completes successfully |

## User Flow

1. User clicks "Bulk Prediction" button
2. Dialog opens with two input options:
   - Manual input: comma-separated material numbers
   - CSV upload: upload a CSV file with material numbers
3. User enters/uploads material numbers (max 50)
4. User clicks "Start Processing"
5. Progress bar shows real-time progress with:
   - Current material being processed
   - Progress percentage
   - Estimated time remaining
6. On completion, summary shows:
   - Success count (green)
   - Cached count (blue)
   - Failed count (red)
   - List of failed items with error messages
7. User can download results as Excel file
8. User clicks "Close" to dismiss dialog

## CSV Format

The CSV file should have a column containing material numbers. The `CSVUpload` component will automatically detect and extract material numbers from the file.

Example CSV:
```csv
Material Number
MAT001
MAT002
MAT003
```

Or with additional columns (only material numbers will be extracted):
```csv
Material Number,Description,Category
MAT001,Product A,Category 1
MAT002,Product B,Category 2
MAT003,Product C,Category 1
```

## Excel Export Format

The downloaded Excel file includes:
- Material Number
- Status (SUCCESS, FAILED, CACHED)
- Prediction ID
- Error (if failed)

Filename format: `Bulk_Prediction_{Type}_{Date}.xlsx`

Example: `Bulk_Prediction_Replenishment_2024-01-15.xlsx`

## Requirements Fulfilled

- ✅ **4.1**: Bulk_Processor interface on each tab
- ✅ **4.5**: Progress bar with status for each product
- ✅ **4.9**: Summary report on completion
- ✅ **4.10**: Download results as Excel button

## Notes

- Processing is sequential with 2-second delay between requests to avoid rate limiting
- Cached predictions (< 24 hours old) are reused automatically
- Maximum 50 products per batch to prevent overwhelming the system
- Failed predictions don't stop the batch - processing continues
- All predictions in a batch are tagged with the same batch ID for tracking
