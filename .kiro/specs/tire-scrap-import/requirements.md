# Requirements Document

## Introduction

This feature adds a dedicated Excel import capability to the "Tire Performance > Tire Scrap" page. Users can upload Excel files containing detailed tire scrap records (including serial numbers, fitment/removal dates, tread wear, hours, removal causes, etc.) and view the imported data summarized in a table list. The import handles the full tire lifecycle data columns and persists them for reporting and analysis.

## Glossary

- **Tire_Scrap_Importer**: The system component responsible for reading, validating, and persisting tire scrap data from uploaded Excel files.
- **Tire_Scrap_Table**: The UI table component that displays imported tire scrap records in a summarized list view on the Tire Scrap page.
- **Excel_Parser**: The sub-component that reads .xlsx/.xls/.csv files and extracts row data into structured objects.
- **Scrap_Record**: A single tire scrap data entry containing all lifecycle fields (serial, fitment date, removal date, hours, tread wear, removal cause, etc.).
- **Column_Mapper**: The logic that maps Excel column headers to internal Scrap_Record fields regardless of minor header variations.
- **Summary_View**: The aggregated table display that groups and summarizes imported scrap records by key dimensions (end user, mine site, manufacture, specification).

## Requirements

### Requirement 1: Excel File Upload

**User Story:** As a tire performance analyst, I want to upload an Excel file containing tire scrap data, so that I can import bulk records without manual entry.

#### Acceptance Criteria

1. WHEN the user clicks the Import button on the Tire Scrap tab, THE Tire_Scrap_Importer SHALL display a file upload dialog accepting .xlsx, .xls, and .csv file formats with a maximum file size of 10 MB.
2. WHEN the user selects a file with a valid extension (.xlsx, .xls, or .csv) and the file size is within the 10 MB limit, THE Excel_Parser SHALL read the file contents, treat the first row as the column header row, and extract all subsequent rows as data rows from the first worksheet.
3. IF the selected file is not a valid Excel or CSV file, or the file is corrupted and cannot be parsed, THEN THE Tire_Scrap_Importer SHALL display an error message indicating the file format is unsupported or the file is corrupted.
4. IF the selected file contains no data rows (only a header row or is completely empty), THEN THE Tire_Scrap_Importer SHALL display an error message indicating the file contains no importable data.
5. IF the selected file exceeds the 10 MB size limit, THEN THE Tire_Scrap_Importer SHALL display an error message indicating the file exceeds the maximum allowed size.

### Requirement 2: Column Mapping

**User Story:** As a tire performance analyst, I want the system to automatically map Excel columns to the correct data fields, so that I do not need to manually configure column mappings each time.

#### Acceptance Criteria

1. WHEN an Excel file is parsed, THE Column_Mapper SHALL map the following Excel headers to internal fields: INPUT DATE, DATA LOGGER, End User, Mine site, Vehicle, Manufacture, Spesification, Serial, disposition, First Fitment Date, Quarter Period Fit, Semester Period Fit, OTD, RTD, Front H, Rear H, Trailer H, Total H, Last Unit No, Last Pos., TW%, Hours/%, Km/%, Date Removed, Quarter Period Removed, Semester Period Removed, Customer Removal Cause, MI 1st Reason, MI 2nd Reason, Picture, Sources.
2. THE Column_Mapper SHALL perform case-insensitive header matching by comparing the lowercased version of each file header against the lowercased version of each expected header.
3. THE Column_Mapper SHALL trim leading and trailing whitespace characters from column headers before matching.
4. IF a column header from the expected list in criterion 1 is not found in the file after applying case-insensitive and whitespace-trimmed matching, THEN THE Column_Mapper SHALL map that field as null for each record in the parsed output.
5. WHEN an Excel file contains column headers not present in the expected list defined in criterion 1, THE Column_Mapper SHALL ignore those columns and exclude their data from the mapped output.
6. IF the Excel file contains duplicate column headers that match the same expected field, THEN THE Column_Mapper SHALL use the first occurrence (leftmost column) for mapping and ignore subsequent duplicates.

### Requirement 3: Data Validation and Normalization

**User Story:** As a tire performance analyst, I want imported data to be validated and normalized, so that the database contains clean and consistent records.

#### Acceptance Criteria

1. WHEN data rows are extracted, THE Tire_Scrap_Importer SHALL trim leading and trailing whitespace from all string field values.
2. WHEN a numeric field (OTD, RTD, Front H, Rear H, Trailer H, Total H, TW%, Hours/%, Km/%) contains a value that cannot be parsed as a finite number, THE Tire_Scrap_Importer SHALL normalize the value to zero.
3. WHEN a date field (INPUT DATE, First Fitment Date, Date Removed) contains a valid Excel serial date number (integer between 1 and 2958465), THE Tire_Scrap_Importer SHALL convert the value to a date string in YYYY-MM-DD format.
4. IF a date field contains a value that is not a valid Excel serial date number and is not empty, THEN THE Tire_Scrap_Importer SHALL retain the original string value without conversion.
5. THE Tire_Scrap_Importer SHALL filter out rows where all fields are empty or contain only whitespace after trimming.
6. WHEN a row contains at least one field with a non-whitespace value after trimming, THE Tire_Scrap_Importer SHALL include the row in the import set.

### Requirement 4: Import Preview

**User Story:** As a tire performance analyst, I want to preview the data before confirming the import, so that I can verify the file contents are correct.

#### Acceptance Criteria

1. WHEN an Excel file is successfully parsed, THE Tire_Scrap_Importer SHALL display a preview table showing the first 10 rows from the parsed data.
2. WHEN an Excel file is successfully parsed, THE Tire_Scrap_Importer SHALL display the total number of rows ready for import above the preview table.
3. WHEN an Excel file is successfully parsed, THE Tire_Scrap_Importer SHALL display the following columns in the preview table: Serial, End User, Mine Site, Manufacture, Specification, Total H, TW%, Date Removed, and Customer Removal Cause.
4. WHEN the user clicks the Import Data button, THE Tire_Scrap_Importer SHALL disable the Import Data button to prevent duplicate submissions and proceed with persisting all validated rows to the database.
5. WHEN the user clicks the Cancel button, THE Tire_Scrap_Importer SHALL discard the parsed data and close the dialog without persisting any records.
6. WHILE the import operation is in progress, THE Tire_Scrap_Importer SHALL display a loading indicator on the Import Data button and keep the button disabled until the operation completes or fails.

### Requirement 5: Data Persistence

**User Story:** As a tire performance analyst, I want imported tire scrap records to be saved to the database, so that the data is available for future viewing and analysis.

#### Acceptance Criteria

1. WHEN the user confirms the import, THE Tire_Scrap_Importer SHALL insert all validated Scrap_Record entries into the tire scrap database table within a single database transaction, for a batch of up to 5000 records.
2. THE Tire_Scrap_Importer SHALL store the authenticated user's identifier as the creator reference on each imported Scrap_Record.
3. WHEN all records in the batch are successfully inserted, THE Tire_Scrap_Importer SHALL display a success notification showing the total number of records imported (e.g., "N records imported") within 2 seconds of transaction completion.
4. IF a database error occurs during insertion, THEN THE Tire_Scrap_Importer SHALL roll back the entire transaction so that zero records from the batch are persisted, and display an error message indicating that the import failed and no records were saved.
5. WHEN the import completes successfully, THE Tire_Scrap_Importer SHALL reload the Tire Scrap page data to display the newly imported records without requiring a manual page refresh by the user.
6. IF the number of validated records exceeds 5000, THEN THE Tire_Scrap_Importer SHALL reject the import and display an error message indicating the maximum batch size has been exceeded.

### Requirement 6: Summary Table Display

**User Story:** As a tire performance analyst, I want to see imported tire scrap data summarized in a table, so that I can quickly analyze scrap patterns across different dimensions.

#### Acceptance Criteria

1. THE Tire_Scrap_Table SHALL display imported scrap records in a summary tabular format with columns: End User, Mine Site, Manufacture, Spesification (mapped from the "Spesification" column in the Excel file), Total Records (count of scrap records per group), Avg Hours (average of Total H per group, rounded to 0 decimal places), Avg TW% (average of TW% per group, rounded to 1 decimal place), and a Customer Removal Cause breakdown showing each unique removal cause with its case count per group.
2. THE Tire_Scrap_Table SHALL aggregate records by End User, Mine Site, Manufacture, and Spesification to produce the summary rows.
3. THE Tire_Scrap_Table SHALL display the Customer Removal Cause breakdown as a sub-list or expandable section within each summary row, showing each distinct cause value and the number of occurrences (e.g., "SIDEWALL SEPARATION: 12, BEAD SEPARATION: 5").
4. THE Tire_Scrap_Table SHALL support a detail view that shows individual scrap records with all columns matching the Excel file: INPUT DATE, DATA LOGGER, End User, Mine Site, Vehicle, Manufacture, Spesification, Serial, disposition, First Fitment Date, Quarter Period Fit, Semester Period Fit, OTD, RTD, Front H, Rear H, Trailer H, Total H, Last Unit No, Last Pos., TW%, Hours/%, Km/%, Date Removed, Quarter Period Removed, Semester Period Removed, Customer Removal Cause, MI 1st Reason, MI 2nd Reason, Picture, Sources.
5. THE Tire_Scrap_Table SHALL show a maximum of 100 records per page with pagination controls when total records exceed 100.
6. WHEN the user types in the search field, THE Tire_Scrap_Table SHALL filter displayed records by performing a case-insensitive substring match of the search term against Serial, End User, Mine Site, Manufacture, Spesification, and Customer Removal Cause fields, beginning filtering after the user has entered at least 1 character.
7. THE Tire_Scrap_Table SHALL provide filter dropdowns for End User, Mine Site, Manufacture, Spesification, and Customer Removal Cause, where selecting values from multiple dropdowns applies all selected filters using AND logic to narrow displayed records.
8. THE Tire_Scrap_Table SHALL sort records by INPUT DATE in descending order by default.
9. IF no records match the active search term or filter selections, THEN THE Tire_Scrap_Table SHALL display an empty state message indicating that no records match the current criteria.
10. WHEN the user applies both a search term and one or more dropdown filters simultaneously, THE Tire_Scrap_Table SHALL display only records that satisfy both the search match AND all active dropdown filter selections.

### Requirement 7: Authentication and Authorization

**User Story:** As a system administrator, I want only authorized users to import tire scrap data, so that data integrity is maintained.

#### Acceptance Criteria

1. WHEN an unauthenticated user attempts to access the Tire Scrap import feature, THE Tire_Scrap_Importer SHALL deny access and redirect the user to the login page within 2 seconds.
2. WHEN an authenticated user without the "create" action permission on the tire scrap resource attempts to import data, THE Tire_Scrap_Importer SHALL deny the import action and display an error message indicating insufficient permissions.
3. THE Tire_Scrap_Importer SHALL use the existing role-based access control system to verify user permissions before rendering the Import button and before executing any import operation.
4. IF the user's session expires during an active import operation, THEN THE Tire_Scrap_Importer SHALL abort the import, discard any uncommitted data, and redirect the user to the login page.
