# NotificationPanel Component Usage

## Overview

The `NotificationPanel` component displays restock alerts for products where current stock is below 20% of recommended stock. It categorizes alerts by urgency level and provides actions to acknowledge notifications or navigate to product details.

## Requirements Implemented

- **8.1**: Notification panel displayed in Dashboard
- **8.3**: Notification badge with count of active alerts
- **8.4**: List of alerts sorted by urgency
- **8.5**: Display Material Number, Product Name, Current Stock, Recommended Stock, Urgency Level
- **8.7**: Sortable by urgency level (automatic)
- **8.8**: Navigation to detail on click
- **8.9**: "Mark as Acknowledged" action

## Features

### Urgency Levels
- **Critical**: Current stock < 10% of recommended (Red)
- **High**: Current stock 10-20% of recommended (Orange)
- **Medium**: Current stock 20-30% of recommended (Yellow)

### Actions
1. **Generate Alerts**: Manually trigger alert generation from recent predictions
2. **View Details**: Navigate to product detail page (requires callback)
3. **Acknowledge**: Mark notification as acknowledged and remove from active list

## Usage

### Basic Usage

```tsx
import { NotificationPanel } from "@/app/dashboard/inventory-ai/_components/notification-panel"

export default function DashboardPage() {
  return (
    <NotificationPanel />
  )
}
```

### With Navigation Callback

```tsx
import { NotificationPanel } from "@/app/dashboard/inventory-ai/_components/notification-panel"
import { useRouter } from "next/navigation"

export default function DashboardPage() {
  const router = useRouter()
  
  const handleNavigateToDetail = (productCode: string) => {
    // Navigate to prediction detail page or product page
    router.push(`/dashboard/inventory-ai/detail?product=${productCode}`)
  }
  
  return (
    <NotificationPanel onNavigateToDetail={handleNavigateToDetail} />
  )
}
```

## Server Actions

The component uses the following server actions from `app/actions/inventory-ai.ts`:

### `getRestockNotifications()`
Fetches all unacknowledged notifications sorted by urgency level.

**Returns:**
```typescript
{
  success: boolean
  data: Notification[]
  totalCount: number
  countByUrgency: {
    critical: number
    high: number
    medium: number
  }
}
```

### `acknowledgeNotification(notificationId: number)`
Marks a notification as acknowledged.

**Returns:**
```typescript
{
  success: boolean
  message: string
}
```

### `generateRestockAlerts()`
Generates new restock alerts from recent predictions (last 30 days).

**Returns:**
```typescript
{
  success: boolean
  message: string
  createdCount: number
  totalEvaluated: number
  breakdown: {
    critical: number
    high: number
    medium: number
  }
}
```

## Integration with Dashboard

To integrate into the main dashboard:

```tsx
import { NotificationPanel } from "@/app/dashboard/inventory-ai/_components/notification-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function InventoryAIClient() {
  return (
    <Tabs defaultValue="dashboard">
      <TabsList>
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="notifications">
          Notifications
          {/* Add badge count here if needed */}
        </TabsTrigger>
        {/* Other tabs */}
      </TabsList>
      
      <TabsContent value="dashboard">
        {/* Dashboard content */}
      </TabsContent>
      
      <TabsContent value="notifications">
        <NotificationPanel onNavigateToDetail={handleNavigate} />
      </TabsContent>
    </Tabs>
  )
}
```

## Styling

The component uses:
- shadcn/ui components (Card, Button, Badge)
- Lucide icons (Bell, AlertTriangle, AlertCircle, Info, CheckCircle2)
- Tailwind CSS for styling
- Color-coded urgency levels with gradient backgrounds

## Auto-refresh

The component loads notifications on mount. To add auto-refresh:

```tsx
useEffect(() => {
  const interval = setInterval(() => {
    loadNotifications()
  }, 300000) // Refresh every 5 minutes

  return () => clearInterval(interval)
}, [])
```

## Notes

- Notifications are automatically sorted by urgency (Critical → High → Medium)
- Acknowledged notifications are removed from the active list
- The "Generate Alerts" button manually triggers alert generation
- Stock percentage progress bar provides visual indication of urgency
- Component handles loading and error states gracefully
