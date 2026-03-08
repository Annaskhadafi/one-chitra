# ComparisonView Integration Guide

## Adding ComparisonView to Inventory AI Dashboard

### Option 1: As a Separate Tab

Add the ComparisonView as a new tab in the main Inventory AI interface:

```tsx
// In inventory-ai-client.tsx or main page component

import { ComparisonView } from './_components/comparison-view'
import { getComparisonData } from '@/app/actions/inventory-ai'

// Add to tabs array
const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'replenishment', label: 'Predictive Replenishment' },
  { id: 'safety-stock', label: 'Dynamic Safety Stock' },
  { id: 'customer-rec', label: 'Customer Recommendation' },
  { id: 'comparison', label: 'Prediction vs Actual' }, // NEW TAB
]

// In the tab content rendering
{activeTab === 'comparison' && (
  <ComparisonTab />
)}
```

### Option 2: As a Modal/Dialog

Open ComparisonView in a dialog from the dashboard:

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ComparisonView } from './_components/comparison-view'

function DashboardTab() {
  const [showComparison, setShowComparison] = useState(false)
  
  return (
    <>
      <Button onClick={() => setShowComparison(true)}>
        View Prediction Comparison
      </Button>
      
      <Dialog open={showComparison} onOpenChange={setShowComparison}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prediction vs Actual Comparison</DialogTitle>
          </DialogHeader>
          <ComparisonViewWrapper />
        </DialogContent>
      </Dialog>
    </>
  )
}
```

### Option 3: Server Component with Client Interactivity

Create a server component wrapper that fetches data:

```tsx
// app/dashboard/inventory-ai/_components/comparison-tab.tsx
import { getComparisonData } from '@/app/actions/inventory-ai'
import { ComparisonView } from './comparison-view'

export async function ComparisonTab() {
  const result = await getComparisonData({ timePeriod: 'all' })
  
  if (!result.success) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load comparison data</p>
        <p className="text-sm text-muted-foreground">{result.error}</p>
      </div>
    )
  }

  return (
    <ComparisonView 
      data={result.data || []}
      summary={result.summary || {
        averageVariance: 0,
        totalOverPrediction: 0,
        totalUnderPrediction: 0,
        totalComparisons: 0
      }}
    />
  )
}
```

### Option 4: Client Component with Data Fetching

For dynamic filtering, use a client component with state:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { ComparisonView } from './comparison-view'
import { getComparisonData } from '@/app/actions/inventory-ai'
import type { ComparisonDataItem, ComparisonSummary } from '@/app/actions/inventory-ai'

export function ComparisonTabClient() {
  const [data, setData] = useState<ComparisonDataItem[]>([])
  const [summary, setSummary] = useState<ComparisonSummary>({
    averageVariance: 0,
    totalOverPrediction: 0,
    totalUnderPrediction: 0,
    totalComparisons: 0
  })
  const [loading, setLoading] = useState(true)

  const fetchData = async (timePeriod: 'monthly' | 'quarterly' | 'all') => {
    setLoading(true)
    const result = await getComparisonData({ timePeriod })
    
    if (result.success) {
      setData(result.data || [])
      setSummary(result.summary || summary)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData('all')
  }, [])

  if (loading) {
    return <div className="text-center py-12">Loading comparison data...</div>
  }

  return (
    <ComparisonView 
      data={data}
      summary={summary}
      onTimePeriodChange={fetchData}
    />
  )
}
```

## Adding to Navigation

Update the main inventory-ai page to include the comparison view:

```tsx
// app/dashboard/inventory-ai/page.tsx

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ComparisonTab } from './_components/comparison-tab'

export default function InventoryAIPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">AI Inventory Forecast</h1>
      
      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="replenishment">Replenishment</TabsTrigger>
          <TabsTrigger value="safety-stock">Safety Stock</TabsTrigger>
          <TabsTrigger value="customer">Customer Rec</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard">
          {/* Dashboard content */}
        </TabsContent>
        
        <TabsContent value="comparison">
          <ComparisonTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

## Quick Action from Dashboard

Add a quick link from the dashboard metrics:

```tsx
// In dashboard-tab.tsx

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

<Card>
  <CardHeader>
    <CardTitle>Prediction Accuracy</CardTitle>
    <CardDescription>Average accuracy this month</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-bold">
      {metrics.averageAccuracy?.toFixed(1)}%
    </div>
    <Button 
      variant="link" 
      className="mt-2 p-0 h-auto"
      onClick={() => setActiveTab('comparison')}
    >
      View detailed comparison
      <ArrowRight className="ml-1 h-4 w-4" />
    </Button>
  </CardContent>
</Card>
```

## Data Update Schedule

The comparison data should be updated regularly using the `updateComparisonData()` function:

```tsx
// Set up a cron job or scheduled task
// Example: Using Vercel Cron or similar

// app/api/cron/update-comparison/route.ts
import { updateComparisonData } from '@/app/actions/inventory-ai'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const result = await updateComparisonData()
  
  return NextResponse.json(result)
}
```

## Testing the Integration

1. Navigate to the Inventory AI page
2. Click on the "Comparison" tab
3. Verify that comparison data loads
4. Test sorting by clicking column headers
5. Test time period filtering
6. Click rows to expand details
7. Verify chart displays correctly

## Troubleshooting

### No data showing
- Ensure predictions have `actualSales` data populated
- Run `updateComparisonData()` to fetch latest sales data
- Check that predictions are older than 30 days (for actual sales comparison)

### Chart not rendering
- Verify Recharts is installed: `npm install recharts`
- Check browser console for errors
- Ensure data format matches expected structure

### Slow performance
- Limit data to recent time periods (monthly/quarterly)
- Add pagination if dataset is very large
- Consider server-side filtering
