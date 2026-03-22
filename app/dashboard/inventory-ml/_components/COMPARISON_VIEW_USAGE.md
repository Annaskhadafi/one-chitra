# ComparisonView Component Usage

## Overview

The `ComparisonView` component displays a side-by-side comparison of predicted stock vs actual sales data. It provides visual analytics through charts and tables, with sorting, filtering, and drill-down capabilities.

## Features

- **Summary Statistics**: Displays total comparisons, average variance, over-predictions, and under-predictions
- **Bar Chart Visualization**: Shows top 10 products by variance with predicted vs actual comparison
- **Sortable Table**: Sort by variance, product name, or date
- **Variance Highlighting**: Rows with variance >30% are highlighted in red
- **Drill-down Details**: Click any row to expand and view detailed prediction information
- **Time Period Filtering**: Filter by monthly, quarterly, or all time
- **Color-coded Indicators**: Visual badges for high, medium, and low variance levels

## Requirements Fulfilled

- **7.1**: Side-by-side comparison table of predicted vs actual
- **7.2**: Display predicted stock and actual sales data
- **7.4**: Bar chart visualization for comparison
- **7.5**: Highlight rows with variance >30% in warning color
- **7.8**: Sortable columns (variance, product name, date)
- **7.9**: Drill-down capability to view prediction details

## Usage Example

```tsx
import { ComparisonView } from '@/app/dashboard/inventory-ml/_components/comparison-view'
import { getComparisonData } from '@/app/actions/inventory-ml'

export default async function ComparisonPage() {
  const result = await getComparisonData({ timePeriod: 'monthly' })
  
  if (!result.success || !result.data) {
    return <div>Failed to load comparison data</div>
  }

  return (
    <ComparisonView 
      data={result.data}
      summary={result.summary}
      onTimePeriodChange={async (period) => {
        'use server'
        // Handle time period change
        const newData = await getComparisonData({ timePeriod: period })
        // Update UI with new data
      }}
    />
  )
}
```

## Props

### `data: ComparisonDataItem[]`
Array of comparison data items containing:
- `predictionId`: Unique prediction identifier
- `productCode`: Material/product code
- `productName`: Product description
- `predictionType`: Type of prediction (REPLENISHMENT, SAFETY_STOCK, etc.)
- `predictedStock`: Predicted stock quantity
- `actualSales`: Actual sales quantity
- `variancePercentage`: Calculated variance percentage
- `predictionDate`: Date when prediction was made
- `currentStock`: Current stock level (optional)

### `summary: ComparisonSummary`
Summary statistics containing:
- `averageVariance`: Average variance across all comparisons
- `totalOverPrediction`: Count of over-predictions (predicted > actual)
- `totalUnderPrediction`: Count of under-predictions (predicted < actual)
- `totalComparisons`: Total number of comparisons

### `onTimePeriodChange?: (period: 'monthly' | 'quarterly' | 'all') => void`
Optional callback function triggered when user changes the time period filter.

## Variance Calculation

Variance is calculated using the formula:
```
variance = ((predicted - actual) / actual) * 100
```

- **Positive variance**: Over-prediction (predicted > actual)
- **Negative variance**: Under-prediction (predicted < actual)

## Variance Levels

- **High Variance** (>30%): Red badge, red background highlight
- **Medium Variance** (15-30%): Amber badge
- **Low Variance** (<15%): Green badge

## Sorting

Click on column headers to sort:
- **Variance**: Sorts by absolute variance value (highest first by default)
- **Product**: Sorts alphabetically by product name
- **Date**: Sorts by prediction date (newest first by default)

Click again to toggle between ascending and descending order.

## Drill-down Details

Click any table row to expand and view:
- Prediction Type
- Current Stock Level
- Difference (Predicted - Actual)
- Prediction ID

## Chart Visualization

The bar chart shows:
- **Blue bars**: Predicted stock
- **Green bars**: Actual sales
- **Top 10 products**: Sorted by variance (highest first)
- **Interactive tooltips**: Hover to see detailed values

## Time Period Filtering

Select from dropdown:
- **All Time**: Shows all comparison data
- **Last Month**: Shows data from the last 30 days
- **Last Quarter**: Shows data from the last 90 days

## Integration with Server Actions

The component works with the `getComparisonData()` server action:

```tsx
// Server Component
import { getComparisonData } from '@/app/actions/inventory-ml'

const result = await getComparisonData({
  timePeriod: 'monthly',
  dateFrom: new Date('2024-01-01'),
  dateTo: new Date('2024-01-31')
})
```

## Styling

The component uses:
- shadcn/ui components (Table, Card, Badge, Select, Button)
- Recharts for data visualization
- Tailwind CSS for styling
- Responsive design with mobile-friendly layout

## Accessibility

- Sortable columns use button elements with proper ARIA labels
- Color-coded indicators include text labels (not just color)
- Table structure uses semantic HTML
- Interactive elements are keyboard accessible

## Performance Considerations

- Data sorting is memoized using `useMemo`
- Chart data is limited to top 10 items
- Row expansion state is managed efficiently
- No unnecessary re-renders on sort/filter changes
