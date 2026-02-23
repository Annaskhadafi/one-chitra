# Design Document: Stock Opname Enhancement

## Overview

This design enhances the existing stock opname (physical inventory count) system by adding pre-count documentation capabilities and PDF report generation. The enhancement supports formal audit documentation requirements and consignment inventory tracking by capturing when, where, and who performed the count, along with generating professional PDF reports.

The system currently supports creating stock opname sessions, recording physical counts, and calculating variances. This enhancement adds:
- Pre-count form with date, time, and location fields
- Multiple signature entries with name and position
- PDF report generation with company branding
- Consignment item identification in reports
- Data integrity guarantees for closed sessions

## Architecture

### System Context

The stock opname enhancement integrates with the existing Next.js application architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer (Browser)                   │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Opname Form UI │  │ Session View │  │ PDF Preview UI  │ │
│  └────────────────┘  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Server Actions Layer                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  createStockOpnameSession (enhanced)                   │ │
│  │  closeStockOpnameSession (enhanced)                    │ │
│  │  generateOpnamePdfReport (new)                         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                          │
│  ┌──────────────────────┐  ┌──────────────────────────────┐│
│  │ stock_opname_sessions│  │ stock_opname_signatures      ││
│  │ (enhanced)           │  │ (new)                        ││
│  └──────────────────────┘  └──────────────────────────────┘│
│  ┌──────────────────────┐  ┌──────────────────────────────┐│
│  │ stock_opname_items   │  │ products (with consignment)  ││
│  └──────────────────────┘  └──────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: React 18+ with Next.js 14+ App Router
- **Backend**: Next.js Server Actions
- **Database**: PostgreSQL with Drizzle ORM
- **PDF Generation**: Browser print API (window.print) with styled HTML
- **Validation**: Zod schemas
- **Authentication**: Better Auth (existing)

### Design Decisions

1. **Browser-based PDF Generation**: Following the existing pattern in quotations, we use styled HTML with browser print rather than server-side PDF libraries. This approach:
   - Maintains consistency with existing codebase
   - Reduces server load and dependencies
   - Provides instant preview capability
   - Allows users to control print settings

2. **Separate Signatures Table**: Creating a dedicated `stock_opname_signatures` table rather than storing signatures as JSON:
   - Enables proper relational queries
   - Supports data validation at database level
   - Allows future extensions (e.g., digital signatures)
   - Maintains data integrity

3. **Consignment Flag on Products**: Adding a boolean flag to the products table rather than a separate consignment tracking system:
   - Simple and performant
   - Sufficient for current requirements
   - Easy to query and filter
   - Can be extended later if needed

4. **Immutable Report Data**: Storing a snapshot of report data at closure time:
   - Ensures audit trail integrity
   - Prevents retroactive modifications
   - Supports compliance requirements
   - Implemented via timestamp-based queries

## Components and Interfaces

### Database Schema Extensions

#### Enhanced stock_opname_sessions Table

```typescript
export const stockOpnameSessions = pgTable("stock_opname_sessions", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    warehouseId: integer("warehouse_id").references(() => warehouses.id).notNull(),
    status: stockOpnameStatusEnum("status").default("open").notNull(),
    notes: text("notes"),
    
    // New fields for pre-count documentation
    opnameDate: timestamp("opname_date").notNull(),
    opnameTime: varchar("opname_time", { length: 10 }).notNull(), // HH:MM format
    location: varchar("location", { length: 200 }).notNull(),
    
    createdById: text("created_by_id").references(() => user.id),
    closedById: text("closed_by_id").references(() => user.id),
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

#### New stock_opname_signatures Table

```typescript
export const stockOpnameSignatures = pgTable("stock_opname_signatures", {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
        .references(() => stockOpnameSessions.id, { onDelete: "cascade" })
        .notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    position: varchar("position", { length: 200 }).notNull(),
    order: integer("order").notNull(), // Display order in report
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

#### Enhanced products Table

```typescript
export const products = pgTable("products", {
    // ... existing fields ...
    
    // New field for consignment tracking
    isConsignment: boolean("is_consignment").default(false).notNull(),
});
```

### Server Actions

#### createStockOpnameSession (Enhanced)

```typescript
interface CreateOpnameSessionInput {
    name: string;
    warehouseId: number;
    notes?: string;
    opnameDate: Date;
    opnameTime: string; // HH:MM format
    location: string;
    signatures: Array<{
        name: string;
        position: string;
    }>;
}

async function createStockOpnameSession(
    data: CreateOpnameSessionInput
): Promise<{ success: boolean; sessionId?: number; error?: string }>
```

**Behavior**:
- Validates at least one signature entry exists
- Creates session with pre-count documentation
- Inserts signature entries with proper ordering
- Populates stock items from current warehouse inventory
- Returns session ID for navigation

#### generateOpnamePdfReport (New)

```typescript
interface OpnamePdfReportData {
    session: StockOpnameSession;
    signatures: StockOpnameSignature[];
    items: Array<StockOpnameItem & { product: Product }>;
    companyLogo: string;
}

async function getOpnamePdfReportData(
    sessionId: number
): Promise<{ success: boolean; data?: OpnamePdfReportData; error?: string }>
```

**Behavior**:
- Validates session is closed
- Fetches session data with all relations
- Returns structured data for PDF rendering
- Includes closure timestamp and user information

### UI Components

#### OpnamePreCountForm

```typescript
interface OpnamePreCountFormProps {
    onSubmit: (data: CreateOpnameSessionInput) => Promise<void>;
    warehouses: Warehouse[];
}
```

**Features**:
- Date and time pickers for opname scheduling
- Location text input
- Dynamic signature entry list (add/remove)
- Validation: minimum 1 signature required
- Form state management with react-hook-form

#### OpnamePdfPreview

```typescript
interface OpnamePdfPreviewProps {
    sessionId: number;
    open: boolean;
    onClose: () => void;
}
```

**Features**:
- Fetches report data on mount
- Renders printable HTML layout
- Company logo in header
- Participant list section
- Stock variance table with consignment indicators
- Signature section with horizontal layout
- Print button triggering window.print()

### PDF Report Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Company Logo]                                              │
│                                                              │
│  STOCK OPNAME REPORT                                         │
│  Session: {name}                                             │
│  Date: {opnameDate} Time: {opnameTime}                      │
│  Location: {location}                                        │
│  Warehouse: {warehouse.name}                                 │
│                                                              │
│  Participants:                                               │
│  - {name} ({position})                                       │
│  - {name} ({position})                                       │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Product Name    │ System │ Physical │ Variance │ Notes     │
├─────────────────────────────────────────────────────────────┤
│  Product A       │   100  │    98    │    -2    │           │
│  Product B (C)   │    50  │    50    │     0    │           │
│  Product C       │    75  │    80    │    +5    │ Recount   │
└─────────────────────────────────────────────────────────────┘
│                                                              │
│  Closed by: {closedBy.name} on {closedAt}                   │
│                                                              │
│  Signatures:                                                 │
│  _______________  _______________  _______________           │
│  {name}           {name}           {name}                    │
│  {position}       {position}       {position}                │
└─────────────────────────────────────────────────────────────┘

Note: (C) indicates consignment items
```

## Data Models

### StockOpnameSession (Enhanced)

```typescript
interface StockOpnameSession {
    id: number;
    name: string;
    warehouseId: number;
    status: "open" | "closed" | "cancelled";
    notes: string | null;
    
    // Pre-count documentation
    opnameDate: Date;
    opnameTime: string;
    location: string;
    
    // Audit fields
    createdById: string | null;
    closedById: string | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    
    // Relations
    warehouse?: Warehouse;
    createdBy?: User;
    closedBy?: User;
    items?: StockOpnameItem[];
    signatures?: StockOpnameSignature[];
}
```

### StockOpnameSignature (New)

```typescript
interface StockOpnameSignature {
    id: number;
    sessionId: number;
    name: string;
    position: string;
    order: number;
    createdAt: Date;
}
```

### Product (Enhanced)

```typescript
interface Product {
    // ... existing fields ...
    isConsignment: boolean;
}
```

### Validation Schemas

```typescript
const createOpnameSessionSchema = z.object({
    name: z.string().min(1, "Session name is required"),
    warehouseId: z.number().int().positive(),
    notes: z.string().optional(),
    opnameDate: z.date(),
    opnameTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
    location: z.string().min(1, "Location is required"),
    signatures: z.array(
        z.object({
            name: z.string().min(1, "Name is required"),
            position: z.string().min(1, "Position is required"),
        })
    ).min(1, "At least one signature is required"),
});
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Session Data Round-Trip Persistence

*For any* valid stock opname session with date, time, location, and signature entries, after saving and then retrieving the session from the database, all fields should match the original values exactly.

**Validates: Requirements 1.4, 1.5, 2.5**

### Property 2: Multiple Signatures Support

*For any* number of signature entries (from 1 to a reasonable maximum like 20), the system should accept, store, and retrieve all signature entries in the correct order.

**Validates: Requirements 2.3**

### Property 3: Signature Entry Removal Before Save

*For any* set of signature entries added to the form, removing any subset of them before submission should result in only the remaining entries being present in the form state.

**Validates: Requirements 2.4**

### Property 4: Minimum Signature Validation

*For any* session creation attempt with zero signature entries, the system should reject the request with a validation error.

**Validates: Requirements 2.6**

### Property 5: PDF Report Required Sections

*For any* closed stock opname session, the generated PDF report should contain all required sections: company logo, date/time/location, participant list, stock variance table with all specified columns (Product Name, System Quantity, Physical Quantity, Variance, Notes), and signature section.

**Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.8**

### Property 6: PDF Report Item Completeness

*For any* closed session with N stock opname items, the generated PDF report should contain exactly N rows in the variance table.

**Validates: Requirements 3.6**

### Property 7: Variance Calculation Correctness

*For any* stock opname item with system quantity S and physical quantity P, the displayed variance in the PDF report should equal P - S.

**Validates: Requirements 3.7**

### Property 8: Consignment Item Identification

*For any* product marked as consignment in a stock opname session, the PDF report should display a visual indicator (such as "(C)" suffix or badge) next to the product name.

**Validates: Requirements 4.1, 4.2**

### Property 9: Closed Session Data Integrity

*For any* closed stock opname session, the generated PDF report should only include data associated with that specific session ID and should not include data from other sessions.

**Validates: Requirements 5.1**

### Property 10: PDF Report Closure Metadata

*For any* closed stock opname session, the generated PDF report should display both the closure timestamp and the name of the user who closed the session.

**Validates: Requirements 5.2, 5.3**

### Property 11: Open Session PDF Prevention

*For any* stock opname session with status "open" or "cancelled", attempting to generate a PDF report should be rejected with an appropriate error.

**Validates: Requirements 5.4**

### Property 12: Report Data Immutability

*For any* closed stock opname session, if the underlying session or item data is modified after closure, regenerating the PDF report should still reflect the data as it existed at the time of closure (based on the closedAt timestamp).

**Validates: Requirements 5.5**

## Error Handling

### Validation Errors

**Pre-Count Form Validation**:
- Empty session name → "Session name is required"
- No warehouse selected → "Warehouse is required"
- Invalid date (future date beyond reasonable limit) → "Invalid opname date"
- Invalid time format → "Time must be in HH:MM format"
- Empty location → "Location is required"
- Zero signatures → "At least one participant signature is required"
- Empty signature name → "Participant name is required"
- Empty signature position → "Participant position is required"

**PDF Generation Validation**:
- Session not found → "Stock opname session not found"
- Session not closed → "Cannot generate PDF for open or cancelled sessions"
- Missing required data → "Incomplete session data, cannot generate report"

### Database Errors

**Transaction Failures**:
- Session creation failure → Rollback transaction, return error message
- Signature insertion failure → Rollback entire session creation
- Foreign key violations → Return user-friendly error message

**Concurrency Issues**:
- Session closed by another user → "Session has been closed by another user"
- Concurrent modifications → Use optimistic locking with updatedAt timestamp

### System Errors

**PDF Generation Failures**:
- Missing company logo → Use placeholder or text-only header
- Browser print API unavailable → Display error message with fallback instructions
- Large dataset rendering issues → Implement pagination or warn user

**File System Errors**:
- Logo file not found → Log error, use fallback
- Insufficient permissions → Return appropriate error message

### Error Response Format

```typescript
interface ErrorResponse {
    success: false;
    error: string; // User-friendly message
    code?: string; // Error code for client-side handling
    details?: unknown; // Additional error details (dev mode only)
}
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both testing approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing

**Library**: We will use **fast-check** for TypeScript property-based testing, which integrates well with the existing Jest/Vitest test infrastructure.

**Configuration**:
- Each property test must run a minimum of 100 iterations
- Each test must include a comment tag referencing the design property
- Tag format: `// Feature: stock-opname-enhancement, Property {number}: {property_text}`

**Property Test Examples**:

```typescript
// Feature: stock-opname-enhancement, Property 1: Session Data Round-Trip Persistence
test("session data persists correctly through save and retrieve", async () => {
    await fc.assert(
        fc.asyncProperty(
            sessionDataArbitrary(),
            async (sessionData) => {
                const created = await createStockOpnameSession(sessionData);
                const retrieved = await getStockOpnameSession(created.sessionId);
                
                expect(retrieved.opnameDate).toEqual(sessionData.opnameDate);
                expect(retrieved.opnameTime).toEqual(sessionData.opnameTime);
                expect(retrieved.location).toEqual(sessionData.location);
                expect(retrieved.signatures).toHaveLength(sessionData.signatures.length);
            }
        ),
        { numRuns: 100 }
    );
});

// Feature: stock-opname-enhancement, Property 7: Variance Calculation Correctness
test("variance equals physical minus system quantity", async () => {
    await fc.assert(
        fc.asyncProperty(
            fc.integer({ min: 0, max: 10000 }), // systemQty
            fc.integer({ min: 0, max: 10000 }), // physicalQty
            async (systemQty, physicalQty) => {
                const pdfData = await generatePdfWithItem(systemQty, physicalQty);
                const expectedVariance = physicalQty - systemQty;
                
                expect(pdfData.items[0].variance).toBe(expectedVariance);
            }
        ),
        { numRuns: 100 }
    );
});
```

### Unit Testing

**Focus Areas**:
- Specific examples of valid session creation
- Edge cases: maximum signature count, special characters in names
- Error conditions: invalid dates, missing required fields
- Integration points: database transactions, authentication checks
- UI component rendering: form fields present, validation messages

**Unit Test Examples**:

```typescript
describe("OpnamePreCountForm", () => {
    it("renders all required fields", () => {
        render(<OpnamePreCountForm warehouses={mockWarehouses} onSubmit={jest.fn()} />);
        
        expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/time/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
        expect(screen.getByText(/add participant/i)).toBeInTheDocument();
    });
    
    it("shows validation error when no signatures added", async () => {
        const onSubmit = jest.fn();
        render(<OpnamePreCountForm warehouses={mockWarehouses} onSubmit={onSubmit} />);
        
        fireEvent.click(screen.getByText(/submit/i));
        
        expect(await screen.findByText(/at least one participant/i)).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });
});

describe("PDF Generation", () => {
    it("prevents PDF generation for open sessions", async () => {
        const openSession = { id: 1, status: "open" };
        
        const result = await getOpnamePdfReportData(openSession.id);
        
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/cannot generate pdf/i);
    });
    
    it("includes consignment indicator for consignment products", async () => {
        const session = await createSessionWithConsignmentItem();
        await closeStockOpnameSession(session.id);
        
        const pdfData = await getOpnamePdfReportData(session.id);
        const consignmentItem = pdfData.data.items.find(i => i.product.isConsignment);
        
        expect(consignmentItem.displayName).toContain("(C)");
    });
});
```

### Test Data Generators

**Arbitraries for Property Tests**:

```typescript
const signatureArbitrary = () => fc.record({
    name: fc.string({ minLength: 1, maxLength: 200 }),
    position: fc.string({ minLength: 1, maxLength: 200 }),
});

const sessionDataArbitrary = () => fc.record({
    name: fc.string({ minLength: 1, maxLength: 200 }),
    warehouseId: fc.integer({ min: 1, max: 100 }),
    opnameDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
    opnameTime: fc.string({ minLength: 5, maxLength: 5 }).filter(s => /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(s)),
    location: fc.string({ minLength: 1, maxLength: 200 }),
    signatures: fc.array(signatureArbitrary(), { minLength: 1, maxLength: 20 }),
    notes: fc.option(fc.string(), { nil: null }),
});
```

### Integration Testing

**Database Integration**:
- Test transaction rollback on failures
- Test foreign key constraints
- Test cascade deletes for signatures when session is deleted

**Authentication Integration**:
- Test permission checks for session creation
- Test permission checks for PDF generation
- Test user ID tracking in audit fields

### Manual Testing Checklist

- [ ] Create session with various signature counts (1, 5, 10)
- [ ] Verify date picker works correctly
- [ ] Verify time input accepts valid formats
- [ ] Test removing signatures before save
- [ ] Test PDF preview displays correctly
- [ ] Test PDF print functionality in different browsers
- [ ] Verify consignment items show indicator
- [ ] Test with sessions containing many items (100+)
- [ ] Verify closure timestamp appears correctly
- [ ] Test that open sessions cannot generate PDFs

