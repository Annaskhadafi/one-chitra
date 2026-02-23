# Implementation Plan: Stock Opname Enhancement

## Overview

This implementation plan breaks down the stock opname enhancement feature into discrete coding tasks. The feature adds pre-count documentation (date, time, location, signatures) and PDF report generation to the existing stock opname system. Implementation follows a bottom-up approach: database schema first, then server actions, then UI components, with property-based tests integrated throughout.

## Tasks

- [ ] 1. Database schema migrations and models
  - [x] 1.1 Create migration for stock_opname_sessions table enhancements
    - Add opnameDate (timestamp), opnameTime (varchar), and location (varchar) columns
    - Update Drizzle schema definition in schema file
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 1.2 Create stock_opname_signatures table and relations
    - Create new table with id, sessionId, name, position, order, createdAt columns
    - Add foreign key constraint with cascade delete to stock_opname_sessions
    - Define Drizzle schema and relations
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  
  - [x] 1.3 Add isConsignment field to products table
    - Add boolean column with default false
    - Update Drizzle schema definition
    - _Requirements: 4.1, 4.2_
  
  - [x] 1.4 Write property test for session data persistence
    - **Property 1: Session Data Round-Trip Persistence**
    - **Validates: Requirements 1.4, 1.5, 2.5**
    - Test that opnameDate, opnameTime, location, and signatures persist correctly through save/retrieve cycle
    - Use fast-check with sessionDataArbitrary generator (100+ runs)

- [ ] 2. Validation schemas and types
  - [x] 2.1 Create Zod schemas for enhanced session creation
    - Define createOpnameSessionSchema with date, time, location, and signatures validation
    - Add time format regex validation (HH:MM)
    - Add minimum 1 signature validation
    - Export TypeScript types from schemas
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.6_
  
  - [x] 2.2 Write property test for minimum signature validation
    - **Property 4: Minimum Signature Validation**
    - **Validates: Requirements 2.6**
    - Test that zero signatures are rejected with validation error
  
  - [x] 2.3 Create TypeScript interfaces for enhanced data models
    - Define StockOpnameSession interface with new fields
    - Define StockOpnameSignature interface
    - Update Product interface with isConsignment field
    - Define OpnamePdfReportData interface
    - _Requirements: 1.4, 2.5, 4.1_

- [ ] 3. Enhanced createStockOpnameSession server action
  - [x] 3.1 Update createStockOpnameSession to accept new fields
    - Modify function signature to accept CreateOpnameSessionInput
    - Add input validation using Zod schema
    - Update database insert to include opnameDate, opnameTime, location
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 3.2 Implement signature entries insertion logic
    - Insert signature records in transaction with session creation
    - Set order field based on array index
    - Ensure cascade delete relationship works
    - Handle transaction rollback on failure
    - _Requirements: 2.3, 2.5_
  
  - [x] 3.3 Write property test for multiple signatures support
    - **Property 2: Multiple Signatures Support**
    - **Validates: Requirements 2.3**
    - Test that 1 to 20 signatures are stored and retrieved in correct order
    - Use fast-check with array generator (100+ runs)
  
  - [x] 3.4 Write unit tests for createStockOpnameSession
    - Test successful session creation with valid data
    - Test validation errors for missing required fields
    - Test transaction rollback on database errors
    - Test authentication checks
    - _Requirements: 1.4, 2.5, 2.6_

- [x] 4. Checkpoint - Verify database and server action foundation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. PDF report data retrieval server action
  - [-] 5.1 Implement getOpnamePdfReportData server action
    - Create function to fetch session with all relations (signatures, items, products)
    - Validate session exists and is closed
    - Return structured OpnamePdfReportData
    - Include closure timestamp and user information
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [~] 5.2 Write property test for closed session data integrity
    - **Property 9: Closed Session Data Integrity**
    - **Validates: Requirements 5.1**
    - Test that PDF data only includes items from specified session ID
  
  - [~] 5.3 Write property test for open session PDF prevention
    - **Property 11: Open Session PDF Prevention**
    - **Validates: Requirements 5.4**
    - Test that open/cancelled sessions are rejected with error
  
  - [~] 5.4 Write unit tests for getOpnamePdfReportData
    - Test successful data retrieval for closed session
    - Test error for non-existent session
    - Test error for open session
    - Test that all required relations are loaded
    - _Requirements: 5.1, 5.4_

- [ ] 6. Pre-count form UI component
  - [~] 6.1 Create OpnamePreCountForm component
    - Set up react-hook-form with Zod validation
    - Add date picker field for opnameDate
    - Add time input field for opnameTime (HH:MM format)
    - Add text input for location
    - Add warehouse selector dropdown
    - Add session name and notes fields
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [~] 6.2 Implement dynamic signature entry list
    - Create signature entry sub-component with name and position fields
    - Add "Add Participant" button to append new signature entry
    - Add remove button for each signature entry
    - Maintain signature order in form state
    - Display validation error when no signatures present
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_
  
  - [~] 6.3 Write property test for signature removal before save
    - **Property 3: Signature Entry Removal Before Save**
    - **Validates: Requirements 2.4**
    - Test that removing signatures updates form state correctly
  
  - [~] 6.4 Write unit tests for OpnamePreCountForm
    - Test that all required fields render
    - Test add signature functionality
    - Test remove signature functionality
    - Test validation error display for zero signatures
    - Test form submission with valid data
    - _Requirements: 1.1, 2.1, 2.4, 2.6_
  
  - [~] 6.5 Integrate form with createStockOpnameSession action
    - Wire up form submission to server action
    - Handle loading states
    - Display success/error messages
    - Navigate to session detail page on success
    - _Requirements: 1.4, 2.5_

- [ ] 7. Checkpoint - Verify form functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. PDF report preview component
  - [~] 8.1 Create OpnamePdfPreview component structure
    - Set up dialog/modal component with open/close props
    - Fetch report data using getOpnamePdfReportData on mount
    - Handle loading and error states
    - Add print button triggering window.print()
    - _Requirements: 3.1, 3.10_
  
  - [~] 8.2 Implement PDF report header section
    - Add company logo image (with fallback)
    - Display "STOCK OPNAME REPORT" title
    - Show session name, date, time, location
    - Display warehouse name
    - Add print-specific CSS styles
    - _Requirements: 3.2, 3.3_
  
  - [~] 8.3 Implement participants list section
    - Display all signatures from session
    - Format as bulleted list with name and position
    - _Requirements: 3.4_
  
  - [~] 8.4 Implement stock variance table
    - Create table with columns: Product Name, System Quantity, Physical Quantity, Variance, Notes
    - Render one row per stock opname item
    - Calculate and display variance (physical - system)
    - Add consignment indicator "(C)" for isConsignment products
    - Style table for print readability
    - _Requirements: 3.5, 3.6, 3.7, 4.1, 4.2, 4.3_
  
  - [~] 8.5 Write property test for PDF required sections
    - **Property 5: PDF Report Required Sections**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.8**
    - Test that all required sections are present in rendered output
  
  - [~] 8.6 Write property test for PDF item completeness
    - **Property 6: PDF Report Item Completeness**
    - **Validates: Requirements 3.6**
    - Test that PDF contains exactly N rows for N items
  
  - [~] 8.7 Write property test for variance calculation
    - **Property 7: Variance Calculation Correctness**
    - **Validates: Requirements 3.7**
    - Test that variance equals physical minus system quantity for all items
    - Use fast-check with integer generators (100+ runs)
  
  - [~] 8.8 Write property test for consignment identification
    - **Property 8: Consignment Item Identification**
    - **Validates: Requirements 4.1, 4.2**
    - Test that consignment products display visual indicator
  
  - [~] 8.9 Implement signature section at bottom
    - Display horizontal layout of signature placeholders
    - Show name and position for each signature
    - Add signature lines
    - Include note about consignment indicator
    - _Requirements: 3.8, 3.9_
  
  - [~] 8.10 Add closure metadata display
    - Display "Closed by: {user} on {timestamp}"
    - Format timestamp appropriately
    - _Requirements: 5.2, 5.3_
  
  - [~] 8.11 Write property test for closure metadata
    - **Property 10: PDF Report Closure Metadata**
    - **Validates: Requirements 5.2, 5.3**
    - Test that closure timestamp and user are displayed
  
  - [~] 8.12 Write unit tests for OpnamePdfPreview
    - Test component renders with valid session data
    - Test error display for open session
    - Test consignment indicator appears for consignment items
    - Test print button functionality
    - Test loading state display
    - _Requirements: 3.1, 3.10, 4.2, 5.4_

- [ ] 9. Integration and wiring
  - [~] 9.1 Add PDF preview button to session detail page
    - Add "Generate PDF Report" button (only visible when session is closed)
    - Wire button to open OpnamePdfPreview modal
    - Pass session ID to modal component
    - _Requirements: 3.1_
  
  - [~] 9.2 Update session creation flow to use new form
    - Replace or enhance existing session creation UI with OpnamePreCountForm
    - Ensure warehouse list is passed as prop
    - Handle navigation after successful creation
    - _Requirements: 1.1, 2.1_
  
  - [~] 9.3 Add consignment flag to product management UI
    - Add checkbox or toggle for isConsignment in product form
    - Display consignment status in product list
    - _Requirements: 4.1_
  
  - [~] 9.4 Write integration tests for complete flow
    - Test end-to-end session creation with signatures
    - Test end-to-end PDF generation for closed session
    - Test that consignment products flow through correctly
    - _Requirements: 1.4, 2.5, 3.1, 4.1_

- [ ] 10. Data immutability and audit trail
  - [~] 10.1 Implement report data immutability logic
    - Ensure PDF data is fetched based on closedAt timestamp
    - Add logic to prevent modifications to closed sessions
    - Document immutability guarantees in code comments
    - _Requirements: 5.5_
  
  - [~] 10.2 Write property test for report data immutability
    - **Property 12: Report Data Immutability**
    - **Validates: Requirements 5.5**
    - Test that PDF reflects data at closure time even after modifications
  
  - [~] 10.3 Write unit tests for audit trail features
    - Test that closedById and closedAt are set correctly
    - Test that closed sessions cannot be modified
    - Test that PDF data matches closure timestamp
    - _Requirements: 5.2, 5.3, 5.5_

- [ ] 11. Final checkpoint and polish
  - [~] 11.1 Add print-specific CSS styles
    - Create @media print styles for PDF layout
    - Hide unnecessary UI elements in print view
    - Ensure proper page breaks
    - Test in multiple browsers
  
  - [~] 11.2 Error handling and user feedback
    - Add user-friendly error messages for all validation failures
    - Add loading indicators for async operations
    - Add success notifications for session creation
    - Test error scenarios
  
  - [~] 11.3 Accessibility improvements
    - Add proper ARIA labels to form fields
    - Ensure keyboard navigation works
    - Test with screen readers
    - Add focus management for modal
  
  - [~] 11.4 Final integration testing
    - Run all property-based tests
    - Run all unit tests
    - Perform manual testing checklist from design document
    - Verify all requirements are met

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use fast-check with minimum 100 iterations
- All property tests include comment tags referencing design properties
- Database migrations should be run before testing server actions
- UI components depend on server actions being complete
- Print functionality should be tested in Chrome, Firefox, and Safari
