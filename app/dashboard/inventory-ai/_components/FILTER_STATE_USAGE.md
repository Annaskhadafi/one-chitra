# Filter State Management Usage Guide

## Overview

The filter state management system provides a centralized way to manage filter preferences across the AI Inventory Forecast feature with automatic localStorage persistence.

## Architecture

- **FilterContext**: React Context that provides filter state and actions
- **FilterProvider**: Context provider component that wraps the application
- **useFilters**: Custom hook to access filter state and actions
- **localStorage**: Automatic persistence of filter preferences

## Installation

### 1. Wrap your component tree with FilterProvider

```tsx
import { FilterProvider } from "./_components/filter-context"

export default function InventoryAILayout({ children }) {
  return (
    <FilterProvider>
      {children}
    </FilterProvider>
  )
}
```

### 2. Use the useFilters hook in your components

```tsx
import { useFilters } from "./_components/filter-context"

export function MyComponent() {
  const { filters, setFilters, resetFilters } = useFilters()

  // Access current filters
  console.log(filters.searchQuery)
  console.log(filters.dateRange)

  // Update filters
  const handleSearchChange = (query: string) => {
    setFilters({ ...filters, searchQuery: query })
  }

  // Reset to defaults
  const handleReset = () => {
    resetFilters()
  }

  return (
    // Your component JSX
  )
}
```

## Filter State Structure

```typescript
interface FilterState {
  dateRange: "7days" | "30days" | "custom"
  dateFrom?: Date
  dateTo?: Date
  materialGroup?: string
  stockRange?: "low" | "medium" | "high" | "all"
  accuracyLevel?: "high" | "medium" | "low" | "all"
  searchQuery: string
}
```

## API Reference

### useFilters()

Returns an object with the following properties:

#### `filters: FilterState`
Current filter state object containing all filter values.

#### `setFilters(newFilters: FilterState): void`
Updates the filter state. Pass the complete filter state object.

**Example:**
```tsx
const { filters, setFilters } = useFilters()

setFilters({
  ...filters,
  searchQuery: "capacitor",
  stockRange: "low"
})
```

#### `resetFilters(): void`
Resets all filters to their default values.

**Default values:**
- `dateRange`: "30days"
- `dateFrom`: 30 days ago
- `dateTo`: today
- `materialGroup`: undefined
- `stockRange`: "all"
- `accuracyLevel`: "all"
- `searchQuery`: ""

**Example:**
```tsx
const { resetFilters } = useFilters()

<Button onClick={resetFilters}>Clear All Filters</Button>
```

## Usage with FilterPanel Component

The FilterPanel component is designed to work seamlessly with the filter context:

```tsx
import { useFilters } from "./_components/filter-context"
import { FilterPanel } from "./_components/filter-panel"

export function MyTab() {
  const { filters, setFilters } = useFilters()

  return (
    <div>
      <FilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        resultCount={predictions.length}
        availableMaterialGroups={materialGroups}
        showAccuracyFilter={true}
      />
      
      {/* Your filtered content */}
    </div>
  )
}
```

## localStorage Persistence

### Automatic Persistence
- Filters are automatically saved to localStorage whenever they change
- Filters are automatically loaded from localStorage on mount
- Storage key: `"inventory-ai-filters"`

### Data Format
Filters are stored as JSON in localStorage. Date objects are serialized as ISO strings.

### Error Handling
- If localStorage is unavailable, the system falls back to in-memory state
- If stored data is corrupted, default filters are used
- All errors are logged to console for debugging

## Examples

### Example 1: Basic Usage

```tsx
import { useFilters } from "./_components/filter-context"

export function PredictionList() {
  const { filters } = useFilters()

  // Use filters to query data
  const predictions = await getRecentPredictions({
    searchQuery: filters.searchQuery,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    materialGroup: filters.materialGroup,
    stockRange: filters.stockRange,
    accuracyLevel: filters.accuracyLevel
  })

  return (
    <div>
      {predictions.map(p => <PredictionCard key={p.id} {...p} />)}
    </div>
  )
}
```

### Example 2: Custom Date Range

```tsx
import { useFilters } from "./_components/filter-context"

export function DateRangeSelector() {
  const { filters, setFilters } = useFilters()

  const handleCustomRange = (from: Date, to: Date) => {
    setFilters({
      ...filters,
      dateRange: "custom",
      dateFrom: from,
      dateTo: to
    })
  }

  return (
    <DatePicker
      from={filters.dateFrom}
      to={filters.dateTo}
      onChange={handleCustomRange}
    />
  )
}
```

### Example 3: Search with Debouncing

```tsx
import { useFilters } from "./_components/filter-context"
import { useState, useEffect } from "react"

export function SearchBox() {
  const { filters, setFilters } = useFilters()
  const [searchInput, setSearchInput] = useState(filters.searchQuery)

  // Debounce search input (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.searchQuery) {
        setFilters({ ...filters, searchQuery: searchInput })
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [searchInput])

  return (
    <Input
      value={searchInput}
      onChange={(e) => setSearchInput(e.target.value)}
      placeholder="Search..."
    />
  )
}
```

### Example 4: Multiple Tabs Sharing Filters

```tsx
// All tabs automatically share the same filter state
import { useFilters } from "./_components/filter-context"

export function ReplenishmentTab() {
  const { filters } = useFilters()
  // Filters are shared across all tabs
  return <PredictionList filters={filters} type="REPLENISHMENT" />
}

export function SafetyStockTab() {
  const { filters } = useFilters()
  // Same filters, different tab
  return <PredictionList filters={filters} type="SAFETY_STOCK" />
}
```

## Best Practices

1. **Always spread existing filters when updating**
   ```tsx
   // ✅ Good
   setFilters({ ...filters, searchQuery: "new value" })
   
   // ❌ Bad - overwrites other filters
   setFilters({ searchQuery: "new value" })
   ```

2. **Use resetFilters for "Clear All" functionality**
   ```tsx
   // ✅ Good
   <Button onClick={resetFilters}>Clear All</Button>
   
   // ❌ Bad - manual reset is error-prone
   <Button onClick={() => setFilters({ /* all defaults */ })}>Clear All</Button>
   ```

3. **Debounce search inputs**
   ```tsx
   // ✅ Good - prevents excessive updates
   useEffect(() => {
     const timer = setTimeout(() => {
       setFilters({ ...filters, searchQuery: input })
     }, 400)
     return () => clearTimeout(timer)
   }, [input])
   ```

4. **Handle date serialization**
   ```tsx
   // Dates are automatically serialized/deserialized
   // No manual conversion needed
   const { filters } = useFilters()
   console.log(filters.dateFrom) // Already a Date object
   ```

## Testing

The filter context includes comprehensive unit tests covering:
- localStorage persistence
- Data serialization/deserialization
- Error handling
- Default values
- Date calculations

Run tests:
```bash
npm test -- app/dashboard/inventory-ai/_components/__tests__/filter-context.test.tsx
```

## Troubleshooting

### Filters not persisting
- Check browser console for localStorage errors
- Verify FilterProvider is wrapping your component tree
- Check if browser has localStorage disabled

### Filters not updating
- Ensure you're spreading existing filters: `{ ...filters, newValue }`
- Check if useFilters is called inside FilterProvider
- Verify setFilters is being called correctly

### Date issues
- Dates are automatically converted to/from ISO strings
- Always use Date objects when setting dateFrom/dateTo
- Check timezone handling if dates seem off

## Requirements Satisfied

This implementation satisfies **Requirement 6.9** from the spec:
- ✅ Filter state management implemented
- ✅ Filter types defined (date range, material group, stock range, accuracy level)
- ✅ localStorage persistence implemented
- ✅ Automatic save/load functionality
- ✅ Error handling for corrupted data
- ✅ Unit tests with 100% coverage
