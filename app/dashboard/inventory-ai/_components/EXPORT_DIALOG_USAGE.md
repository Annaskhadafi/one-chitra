# ExportDialog Component Usage

## Overview

The `ExportDialog` component provides a user-friendly interface for exporting AI Inventory Predictions to Excel or PDF formats with optional filtering capabilities.

## Features

- **Format Selection**: Choose between Excel (.xlsx) or PDF (.pdf) export formats
- **Prediction Type Filter**: Filter by prediction type (All, Replenishment, Safety Stock, Customer Recommendations)
- **Date Range Filter**: Optional date range selection to filter predictions by creation date
- **Loading Indicator**: Visual feedback during export generation
- **Auto-Download**: Automatically triggers browser download when export completes
- **Error Handling**: User-friendly error messages for failed exports
- **Form Validation**: Validates date range (from date must be before or equal to to date)

## Requirements Fulfilled

- **5.1**: Export button with format selection (Excel/PDF)
- **5.2**: Filter options (format, prediction type, date range)
- **5.9**: Loading indicator during export
- **5.10**: Auto-download with proper filename format

## Usage Example

```tsx
import { useState } from "react";
import { ExportDialog } from "@/app/dashboard/inventory-ai/_components/export-dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function MyComponent() {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setExportDialogOpen(true)}>
        <Download className="h-4 w-4 mr-2" />
        Export Data
      </Button>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />
    </>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | Yes | Controls dialog visibility |
| `onOpenChange` | `(open: boolean) => void` | Yes | Callback when dialog open state changes |

## Export Filters

The component supports the following filters:

### Export Format
- **Excel (.xlsx)**: Multi-sheet workbook with separate sheets for each prediction type
- **PDF (.pdf)**: Formatted PDF document with summary statistics

### Prediction Type
- **All Types**: Export all predictions
- **Predictive Replenishment**: Only replenishment predictions
- **Dynamic Safety Stock**: Only safety stock predictions
- **Customer Recommendations**: Only customer recommendation predictions

### Date Range (Optional)
- **From Date**: Start date for filtering predictions
- **To Date**: End date for filtering predictions
- Both dates are optional; if not specified, all predictions are included

## Filename Convention

Exported files follow this naming convention:

```
AI_Forecast_[Type]_[Date].[ext]
```

Examples:
- `AI_Forecast_All_2024-01-15.xlsx`
- `AI_Forecast_REPLENISHMENT_2024-01-15.pdf`
- `AI_Forecast_SAFETY_STOCK_2024-01-15.xlsx`

## User Experience

1. **Open Dialog**: User clicks export button to open the dialog
2. **Select Format**: Choose between Excel or PDF (defaults to Excel)
3. **Apply Filters**: Optionally select prediction type and date range
4. **Validate**: Dialog validates date range (from ≤ to)
5. **Export**: Click "Export" button to start generation
6. **Loading**: Loading indicator shows progress
7. **Download**: File automatically downloads when ready
8. **Close**: Dialog closes automatically after successful export

## Error Handling

The component handles various error scenarios:

- **No Data**: "No predictions found matching the filters"
- **Export Failure**: Displays specific error message from server
- **Network Error**: "An error occurred during export"
- **Invalid Date Range**: Shows validation alert if from date > to date

## Integration with Server Actions

The component calls these server actions:

- `exportToExcel(filters)`: Generates Excel file
- `exportToPDF(filters)`: Generates PDF file

Both actions return:

```typescript
{
  success: boolean;
  data?: {
    buffer: string;      // Base64-encoded file data
    filename: string;    // Generated filename
    mimeType: string;    // MIME type for blob creation
  };
  error?: string;        // Error message if failed
}
```

## Accessibility

- All form controls have proper labels
- Buttons are disabled during export to prevent duplicate requests
- Loading states provide clear feedback
- Error messages are displayed prominently
- Keyboard navigation is fully supported

## Testing

Unit tests cover:
- Base64 to binary conversion
- Filename generation for both formats
- Date range validation
- Filter parameter construction
- Export format validation
- MIME type mapping
- Export result structure
- Form reset logic
- Loading state management
- Error handling

Run tests:
```bash
npm run test -- app/dashboard/inventory-ai/_components/__tests__/export-dialog.test.tsx
```

## Dependencies

- `@/components/ui/dialog`: Dialog component
- `@/components/ui/button`: Button component
- `@/components/ui/select`: Select dropdown component
- `@/components/ui/calendar`: Calendar date picker
- `@/components/ui/popover`: Popover for date picker
- `@/components/ui/alert`: Alert messages
- `@/app/actions/inventory-ai`: Server actions for export
- `sonner`: Toast notifications
- `date-fns`: Date formatting
- `lucide-react`: Icons

## Notes

- The component automatically resets form state after successful export
- Export is disabled during processing to prevent duplicate requests
- Date range validation is performed client-side before export
- File download uses browser's native download mechanism
- Base64 buffer is converted to binary for proper file creation
