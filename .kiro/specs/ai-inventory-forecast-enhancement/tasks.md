# Implementation Plan: AI Inventory Forecast Enhancement

## Overview

This implementation plan breaks down the 10 major enhancements into actionable coding tasks. Each task builds incrementally on previous work, with testing integrated throughout. The implementation follows Next.js 14 App Router patterns with React Server Components and Client Components.

## Tasks

- [x] 1. Set up foundation and database schema extensions
  - Create new database columns for accuracy tracking and notification system
  - Add indexes for performance optimization
  - Create types and interfaces for new features
  - Set up utility functions for date calculations and formatting
  - _Requirements: 3.1, 3.2, 3.10, 8.10, 10.11_

- [x] 1.1 Write unit tests for utility functions
  - Test date calculation helpers
  - Test formatting functions
  - _Requirements: 3.4, 10.4_

- [x] 2. Implement Dashboard Summary with Key Metrics (Requirement 1)
  - [x] 2.1 Create dashboard data aggregation server action
    - Implement `getDashboardMetrics()` in `app/actions/inventory-ai.ts`
    - Query predictions for last 7 days and 30 days
    - Calculate breakdown by prediction type
    - Identify top 10 products with highest restock recommendations
    - Calculate products approaching restock point (<20% of recommended)
    - Calculate average prediction accuracy for current month
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 2.2 Create Dashboard UI component
    - Create `app/dashboard/inventory-ai/_components/dashboard-tab.tsx`
    - Implement metric cards with icons and values
    - Add quick action buttons for navigation
    - Implement auto-refresh every 5 minutes using React hooks
    - Add loading states and error handling
    - _Requirements: 1.1, 1.8, 1.9, 1.10_

  - [x] 2.3 Write unit tests for dashboard metrics calculation
    - Test metric aggregation logic
    - Test edge cases (no data, single prediction)
    - _Requirements: 1.2, 1.3, 1.4_

- [x] 3. Implement Visualisasi Trend Penjualan dan Prediksi (Requirement 2)
  - [x] 3.1 Create sales history data fetching function
    - Implement `getSalesHistory(materialNo: string)` server action
    - Query salesRevenueSap for last 6 months of data
    - Calculate 3-month moving average
    - Return formatted data for charting
    - _Requirements: 2.2, 2.6_

  - [x] 3.2 Create PredictionChart component
    - Create `app/dashboard/inventory-ai/_components/prediction-chart.tsx`
    - Implement Recharts LineChart with historical sales data
    - Add horizontal line for recommended stock level
    - Add marker for current stock level
    - Add projected restock point on timeline
    - Implement zoom functionality
    - Add tooltip with detailed data on hover
    - Make chart responsive
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9_

  - [x] 3.3 Add chart export to PNG functionality
    - Implement export button using html2canvas or similar
    - Add download handler
    - _Requirements: 2.10_

  - [x] 3.4 Write integration tests for chart data flow
    - Test data fetching and transformation
    - Test chart rendering with sample data
    - _Requirements: 2.1, 2.2_

- [x] 4. Checkpoint - Verify dashboard and charts work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Historical Accuracy Tracking (Requirement 3)
  - [x] 5.1 Create accuracy calculation background job
    - Implement `calculatePredictionAccuracy()` server action
    - Query predictions older than 30 days
    - Fetch actual sales data from salesRevenueSap
    - Calculate accuracy using formula: 100 - ABS((Predicted - Actual) / Actual * 100)
    - Update aiInventoryPredictions table with accuracy values
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 5.2 Create AccuracyTracker component
    - Create `app/dashboard/inventory-ai/_components/accuracy-tracker.tsx`
    - Display accuracy percentage for each prediction
    - Implement color-coded indicators (green >80%, yellow 60-80%, red <60%)
    - Show warning message for accuracy <60%
    - Add filter by product category
    - _Requirements: 3.3, 3.7, 3.8, 3.9_

  - [x] 5.3 Create accuracy trend chart
    - Implement LineChart showing accuracy over 6 months
    - Add to dashboard summary
    - _Requirements: 3.6_

  - [x] 5.4 Write property test for accuracy calculation
    - **Property 1: Accuracy bounds**
    - **Validates: Requirements 3.4**
    - Test that accuracy is always between 0 and 100
    - Test that perfect prediction gives 100% accuracy

- [x] 6. Implement Bulk Prediction untuk Multiple Products (Requirement 4)
  - [x] 6.1 Create bulk prediction processor
    - Implement `processBulkPredictions()` server action
    - Accept array of material numbers (max 50)
    - Process predictions sequentially with 2-second delay
    - Check cache for each product before calling AI
    - Track success/failure for each product
    - Return summary report
    - _Requirements: 4.2, 4.4, 4.5, 4.6, 4.7, 4.8, 4.11_

  - [x] 6.2 Create CSV upload and validation
    - Implement CSV parser in client component
    - Validate CSV format (material number column required)
    - Show preview of parsed data
    - _Requirements: 4.3_

  - [x] 6.3 Create BulkPredictionDialog component
    - Create `app/dashboard/inventory-ai/_components/bulk-prediction-dialog.tsx`
    - Add input for comma-separated material numbers
    - Add CSV file upload option
    - Implement progress bar showing current product being processed
    - Display summary report on completion
    - Add download results as Excel button
    - _Requirements: 4.1, 4.5, 4.9, 4.10_

  - [x] 6.4 Write unit tests for bulk processor
    - Test sequential processing with delay
    - Test error handling for individual failures
    - Test cache utilization
    - _Requirements: 4.6, 4.7, 4.11_

- [x] 7. Implement Export Functionality (Requirement 5)
  - [x] 7.1 Create Excel export function
    - Implement `exportToExcel()` using xlsx library
    - Create separate sheets for each prediction type
    - Include columns: Material Number, Product Name, Current Stock, Recommended Stock, Rationale, Prediction Date, Accuracy
    - Apply filters based on user selection
    - _Requirements: 5.3, 5.4, 5.8_

  - [x] 7.2 Create PDF export function
    - Implement `exportToPDF()` using jsPDF
    - Add company header and timestamp
    - Include summary statistics on first page
    - Format prediction details in table
    - _Requirements: 5.5, 5.6, 5.7_

  - [x] 7.3 Create ExportDialog component
    - Create `app/dashboard/inventory-ai/_components/export-dialog.tsx`
    - Add format selection (Excel/PDF)
    - Add date range filter
    - Add product category filter
    - Implement loading indicator during export
    - Auto-download with proper filename
    - _Requirements: 5.1, 5.2, 5.9, 5.10_

  - [x] 7.4 Write integration tests for export functionality
    - Test Excel generation with sample data
    - Test PDF generation with sample data
    - Test filename generation
    - _Requirements: 5.10, 5.11, 5.12_

- [x] 8. Checkpoint - Verify bulk operations and exports work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Advanced Filters dan Search (Requirement 6)
  - [x] 9.1 Create filter state management
    - Implement filter context or Zustand store
    - Define filter types: date range, material group, stock range, accuracy level
    - Implement localStorage persistence
    - _Requirements: 6.9_

  - [x] 9.2 Create FilterPanel component
    - Create `app/dashboard/inventory-ai/_components/filter-panel.tsx`
    - Add date range selector (Last 7 days, Last 30 days, Custom)
    - Add material group/category dropdown
    - Add stock range filter (Low <100, Medium 100-500, High >500)
    - Add accuracy level filter
    - Add search box with debouncing (400ms)
    - Add "Clear All Filters" button
    - Display result count
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.10_

  - [x] 9.3 Update prediction list to use filters
    - Modify `getRecentPredictions()` to accept filter parameters
    - Apply filters in database query
    - Ensure query performance <1 second
    - _Requirements: 6.7, 6.8_

  - [x] 9.4 Write unit tests for filter logic
    - Test filter combinations
    - Test search debouncing
    - Test localStorage persistence
    - _Requirements: 6.7, 6.9_

- [x] 10. Implement Comparison View (Requirement 7)
  - [x] 10.1 Create comparison data aggregation
    - Implement `getComparisonData()` server action
    - Query predictions with actual sales data
    - Calculate variance percentage
    - Calculate summary statistics
    - Support monthly/quarterly filtering
    - Auto-update daily at 00:00
    - _Requirements: 7.2, 7.3, 7.6, 7.7, 7.10_

  - [x] 10.2 Create ComparisonView component
    - Create `app/dashboard/inventory-ai/_components/comparison-view.tsx`
    - Display side-by-side table of predicted vs actual
    - Highlight rows with variance >30%
    - Implement sortable columns
    - Add bar chart visualization
    - Add drill-down capability to view details
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.8, 7.9_

  - [x] 10.3 Write property test for variance calculation
    - **Property 2: Variance symmetry**
    - **Validates: Requirements 7.3**
    - Test that variance calculation is consistent
    - Test edge cases (zero actual, zero predicted)

- [ ] 11. Implement Notification System (Requirement 8)
  - [x] 11.1 Create notification generation logic
    - Implement `generateRestockAlerts()` server action
    - Query products where current stock < 20% of recommended
    - Categorize urgency: Critical (<10%), High (10-20%), Medium (20-30%)
    - Save notifications to database
    - _Requirements: 8.2, 8.6_

  - [x] 11.2 Create NotificationPanel component
    - Create `app/dashboard/inventory-ai/_components/notification-panel.tsx`
    - Display notification badge with count
    - Show list of alerts sorted by urgency
    - Include Material Number, Product Name, Current Stock, Recommended Stock, Urgency Level
    - Add "Mark as Acknowledged" action
    - Implement navigation to detail on click
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.7, 8.8, 8.9_

  - [x] 11.3 Create notification history tracking
    - Save acknowledged notifications
    - Implement history view
    - _Requirements: 8.10_

  - [ ] 11.4 Create email digest functionality (optional)
    - Implement daily email for critical alerts
    - Use email service (Resend, SendGrid, etc.)
    - _Requirements: 8.11_

- [x] 12. Implement Customizable AI Parameters (Requirement 9)
  - [x] 12.1 Create AI settings database schema
    - Add aiSettings table for configuration
    - Store model selection, temperature, max_tokens, cache_duration
    - _Requirements: 9.8_

  - [x] 12.2 Create AISettingsPage
    - Create `app/dashboard/inventory-ai/settings/page.tsx`
    - Add role-based access control (admin/inventory_manager only)
    - Add model selection dropdown (qwen/qwen3-32b, llama-3.3-70b-versatile, mixtral-8x7b)
    - Add temperature slider (0.0 - 1.0)
    - Add max_tokens input (1000 - 8192)
    - Add cache duration selector (12h, 24h, 48h)
    - Add thinking mode toggle
    - Add test functionality with sample data
    - Display optimal parameter recommendations
    - Implement error handling and revert to defaults
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.9, 9.10, 9.11, 9.12_

  - [x] 12.3 Update prediction functions to use settings
    - Modify `generateAIPrediction()` to read from settings
    - Modify `generateCustomerRecommendation()` to read from settings
    - _Requirements: 9.9_

  - [x] 12.4 Write integration tests for settings
    - Test settings persistence
    - Test parameter application
    - Test error handling and revert
    - _Requirements: 9.8, 9.12_

- [x] 13. Checkpoint - Verify all new features are integrated
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement Performance Optimization dan Caching (Requirement 10)
  - [x] 14.1 Implement lazy loading for history list
    - Add pagination or infinite scroll to prediction history
    - Load 20 items at a time
    - _Requirements: 10.2_

  - [x] 14.2 Implement SAP data caching
    - Add React Query or SWR for client-side caching
    - Cache SAP queries for 1 hour
    - _Requirements: 10.3_

  - [x] 14.3 Implement search debouncing
    - Add 400ms debounce to all search inputs
    - _Requirements: 10.4_

  - [x] 14.4 Implement data preloading
    - Preload dashboard metrics on user login
    - Use Next.js prefetching for tab navigation
    - _Requirements: 10.5, 10.6_

  - [x] 14.5 Implement optimistic UI updates
    - Add optimistic updates for delete operations
    - Show immediate feedback before server confirmation
    - _Requirements: 10.7_

  - [x] 14.6 Implement chart data compression
    - Compress historical data >12 months using aggregation
    - _Requirements: 10.8_

  - [x] 14.7 Add performance monitoring
    - Implement performance logging for slow queries
    - Add database indexes for frequently queried columns
    - _Requirements: 10.1, 10.10, 10.11_

  - [x] 14.8 Implement rate limiting
    - Add rate limiting for Groq API calls (max 10 per minute per user)
    - Show user-friendly message when limit reached
    - _Requirements: 10.12_

  - [x] 14.9 Write performance tests
    - Test dashboard load time <2 seconds
    - Test tab switching <500ms
    - Test filter application <1 second
    - _Requirements: 10.1, 10.6, 10.7_

- [ ] 15. Update main InventoryAIClient component
  - [x] 15.1 Integrate all new components
    - Add Dashboard tab as default
    - Update tab structure to include new features
    - Wire up all new components (charts, filters, exports, etc.)
    - Ensure proper data flow between components
    - _Requirements: 1.1, All requirements_

  - [x] 15.2 Update navigation and routing
    - Ensure smooth navigation between tabs
    - Implement deep linking for specific views
    - _Requirements: 1.10_

  - [x] 15.3 Write end-to-end integration tests
    - Test complete user flows
    - Test dashboard → prediction → export flow
    - Test bulk prediction flow
    - Test notification → detail flow
    - _Requirements: All requirements_

- [ ] 16. Final checkpoint and documentation
  - [x] 16.1 Verify all requirements are met
    - Review each requirement acceptance criteria
    - Test all features manually
    - Ensure all automated tests pass
    - _Requirements: All requirements_

  - [x] 16.2 Update component documentation
    - Add JSDoc comments to all new functions
    - Document component props and usage
    - _Requirements: All requirements_

  - [x] 16.3 Performance validation
    - Verify dashboard loads in <2 seconds
    - Verify tab switching in <500ms
    - Verify filter application in <1 second
    - _Requirements: 10.1, 10.6, 10.7_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- All components follow Next.js 14 App Router patterns with proper Server/Client Component separation
- Use shadcn/ui components for consistent UI
- Use Recharts for all visualizations
- Use Drizzle ORM for all database operations
- Implement proper error handling and loading states throughout
