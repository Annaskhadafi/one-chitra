# Comparison Data Aggregation Setup

## Overview

Task 10.1 implements the comparison data aggregation feature that allows comparing AI predictions with actual sales data from SAP.

## Implementation Details

### Server Actions

**`getComparisonData(filters?: ComparisonFilters)`**
- Queries predictions that have actual sales data
- Calculates variance percentage: `((Predicted - Actual) / Actual * 100)`
- Supports filtering by time period (monthly, quarterly, custom date range)
- Returns comparison data with summary statistics

**`updateComparisonData()`**
- Updates predictions with actual sales data from SAP
- Calculates accuracy percentage for predictions
- Should be called daily to keep data fresh
- Looks at sales data from prediction date to 30 days after

### API Endpoint

**`GET /api/cron/update-comparison-data`**
- Cron job endpoint for daily updates
- Secured with `CRON_SECRET` environment variable
- Scheduled to run daily at 00:00 (midnight)

### Vercel Cron Configuration

The `vercel.json` file has been created with the following cron schedule:

```json
{
  "crons": [
    {
      "path": "/api/cron/update-comparison-data",
      "schedule": "0 0 * * *"
    }
  ]
}
```

This runs the update daily at midnight UTC.

## Setup Instructions

### 1. Environment Variables

Add the following to your `.env` file:

```bash
CRON_SECRET=your_cron_secret_here
```

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Vercel Deployment

When deploying to Vercel:
1. The cron job will be automatically configured from `vercel.json`
2. Add `CRON_SECRET` to your Vercel environment variables
3. The cron job will run daily at 00:00 UTC

### 3. Manual Testing

Test the cron endpoint manually:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://yourdomain.com/api/cron/update-comparison-data
```

### 4. Local Development

For local testing, you can call the server action directly:

```typescript
import { updateComparisonData } from '@/app/actions/inventory-ai'

const result = await updateComparisonData()
console.log(result)
```

## Usage Examples

### Get Comparison Data (All Time)

```typescript
import { getComparisonData } from '@/app/actions/inventory-ai'

const result = await getComparisonData()

if (result.success) {
  console.log('Comparison data:', result.data)
  console.log('Summary:', result.summary)
}
```

### Get Monthly Comparison Data

```typescript
const result = await getComparisonData({ timePeriod: 'monthly' })
```

### Get Quarterly Comparison Data

```typescript
const result = await getComparisonData({ timePeriod: 'quarterly' })
```

### Get Custom Date Range

```typescript
const result = await getComparisonData({
  dateFrom: new Date('2024-01-01'),
  dateTo: new Date('2024-03-31')
})
```

## Data Structure

### ComparisonDataItem

```typescript
{
  predictionId: number
  productCode: string
  productName: string | null
  predictionType: string
  predictedStock: number
  actualSales: number
  variancePercentage: number  // ((Predicted - Actual) / Actual * 100)
  predictionDate: Date
  currentStock: number | null
}
```

### ComparisonSummary

```typescript
{
  averageVariance: number          // Average absolute variance percentage
  totalOverPrediction: number      // Count of predictions where predicted > actual
  totalUnderPrediction: number     // Count of predictions where predicted < actual
  totalComparisons: number         // Total number of comparisons
}
```

## Requirements Fulfilled

- ✅ 7.2: Query predictions with actual sales data
- ✅ 7.3: Calculate variance percentage
- ✅ 7.6: Support monthly/quarterly filtering
- ✅ 7.7: Calculate summary statistics
- ✅ 7.10: Auto-update daily at 00:00

## Next Steps

Task 10.2 will implement the ComparisonView component to display this data in the UI with:
- Side-by-side table of predicted vs actual
- Variance highlighting (>30%)
- Sortable columns
- Bar chart visualization
- Drill-down capability
