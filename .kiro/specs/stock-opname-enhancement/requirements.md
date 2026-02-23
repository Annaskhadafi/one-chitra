# Requirements Document

## Introduction

This document specifies requirements for enhancing the existing stock opname (physical inventory count) system. The enhancement adds pre-count documentation fields and PDF report generation capabilities to support consignment inventory tracking and formal audit documentation.

## Glossary

- **Stock_Opname_System**: The existing inventory physical count management system
- **Opname_Session**: A physical inventory counting session with metadata and items
- **Pre_Count_Form**: Additional form fields for documenting when, where, and who performs the count
- **Signature_Entry**: A nested input structure containing name and position/title fields
- **PDF_Report**: A formatted document containing stock opname results with signatures
- **System_Quantity**: The quantity recorded in the system before physical count
- **Physical_Quantity**: The actual quantity counted during physical inspection
- **Variance**: The difference between Physical_Quantity and System_Quantity
- **Consignment_Item**: Inventory items owned by suppliers but stored in company warehouses

## Requirements

### Requirement 1: Pre-Count Documentation Form

**User Story:** As a warehouse manager, I want to document when and where the stock opname occurs before starting the count, so that I have complete audit trail information.

#### Acceptance Criteria

1. WHEN creating a new Opname_Session, THE Stock_Opname_System SHALL display a Pre_Count_Form
2. THE Pre_Count_Form SHALL include a date and time field for recording when the count occurs
3. THE Pre_Count_Form SHALL include a location field for recording where the count occurs
4. THE Stock_Opname_System SHALL save the date, time, and location with the Opname_Session
5. WHEN viewing an existing Opname_Session, THE Stock_Opname_System SHALL display the saved date, time, and location

### Requirement 2: Multiple Signature Entry

**User Story:** As a warehouse manager, I want to record multiple participants with their names and positions, so that I can document who was responsible for the stock opname.

#### Acceptance Criteria

1. THE Pre_Count_Form SHALL include a section for adding multiple Signature_Entry records
2. WHEN a user adds a Signature_Entry, THE Stock_Opname_System SHALL provide fields for name and position
3. THE Stock_Opname_System SHALL allow adding multiple Signature_Entry records to a single Opname_Session
4. THE Stock_Opname_System SHALL allow removing Signature_Entry records before saving
5. WHEN saving an Opname_Session, THE Stock_Opname_System SHALL persist all Signature_Entry records
6. THE Stock_Opname_System SHALL validate that at least one Signature_Entry exists before allowing session creation

### Requirement 3: PDF Report Generation

**User Story:** As a warehouse manager, I want to generate a PDF report of the stock opname results, so that I can provide formal documentation for consignment items and audits.

#### Acceptance Criteria

1. WHEN an Opname_Session is closed, THE Stock_Opname_System SHALL provide an option to generate a PDF_Report
2. THE PDF_Report SHALL include a header section with the company logo
3. THE PDF_Report SHALL display the date, time, and location of the stock opname
4. THE PDF_Report SHALL list all participants from the Signature_Entry records
5. THE PDF_Report SHALL include a table with columns: Product Name, System_Quantity, Physical_Quantity, Variance, and Notes
6. FOR EACH item in the Opname_Session, THE PDF_Report SHALL display one row in the table
7. THE PDF_Report SHALL calculate and display Variance as Physical_Quantity minus System_Quantity
8. THE PDF_Report SHALL include a signature section at the bottom displaying all Signature_Entry records
9. THE signature section SHALL display name and position for each Signature_Entry in a horizontal layout
10. THE Stock_Opname_System SHALL allow downloading the PDF_Report to the user's device

### Requirement 4: Consignment Item Identification

**User Story:** As a warehouse manager, I want to identify consignment items in the stock opname report, so that I can distinguish between owned and consignment inventory.

#### Acceptance Criteria

1. WHERE a product is marked as a Consignment_Item, THE PDF_Report SHALL indicate this in the product name or notes column
2. THE Stock_Opname_System SHALL provide a visual indicator for Consignment_Item records in the report table
3. WHEN viewing the PDF_Report, users SHALL be able to easily identify which items are consignment inventory

### Requirement 5: Report Data Integrity

**User Story:** As an auditor, I want the PDF report to reflect the exact state of the stock opname at the time it was closed, so that I can trust the report for audit purposes.

#### Acceptance Criteria

1. WHEN generating a PDF_Report, THE Stock_Opname_System SHALL use only data from the closed Opname_Session
2. THE PDF_Report SHALL include the session closure timestamp
3. THE PDF_Report SHALL display the name of the user who closed the session
4. IF an Opname_Session is not closed, THEN THE Stock_Opname_System SHALL prevent PDF_Report generation
5. THE Stock_Opname_System SHALL preserve the PDF_Report content even if the underlying Opname_Session data is modified after closure
