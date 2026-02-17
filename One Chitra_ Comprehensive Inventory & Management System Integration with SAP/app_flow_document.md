# One Chitra App Flow Document

## Onboarding and Sign-In/Sign-Up
When a new user first visits One Chitra, they are greeted by a landing page that clearly displays the One Chitra logo and a brief welcome message. The primary call to action invites users to either sign in or sign up with an email address and password. To create an account, the user clicks on the Sign Up link, enters their name, email, and a secure password, and then confirms their email address via a verification link sent to them. Once verified, they are directed to the login page where they enter their credentials to gain access. If a user forgets their password, they can click the Forgot Password link on the login page, provide their registered email, and receive a password reset link. After updating their password, they return to the login page to sign in. Once authenticated, the user may sign out at any time by clicking their profile icon in the header and selecting Sign Out.

## Main Dashboard or Home Page
After signing in, the user lands on the One Chitra dashboard. Across the top is a header that shows the application name, the current user’s profile picture, and a notification bell. On the left side, a vertical navigation menu lists Inventory, Quotation, Delivery, Billing, Reports, and Admin sections. In the central area, widgets display a real-time comparison of SAP stock versus actual warehouse stock, alerts for low-stock items based on two-level reorder thresholds, a list of pending quotations, scheduled deliveries for the day, and recent billing tasks awaiting export to SAP. Each widget includes a link or button to view the full module. The footer shows the application version and a link to help documentation.

## Detailed Feature Flows and Page Transitions

### Inventory Management
From the Inventory menu, the user sees a multi-warehouse view showing stock levels for each SKU. The default view compares SAP stock data pulled from a read-only API against real stock recorded by One Chitra. The user can switch between warehouses by selecting a dropdown at the top. If stock falls below the first or second reorder point, the system highlights the row in yellow or red respectively. Users can click on any SKU row to see transaction history and initiate an inter-warehouse transfer. When initiating a transfer, the user selects a source warehouse and a destination warehouse, enters a quantity, and submits the transfer request. The system confirms the request and updates the pending transfers widget.

### SAP Synchronization
Users with Manager or Admin roles can navigate to the SAP Sync page under Inventory. There they can choose to run a manual sync or view the schedule for automatic pulls. A sync progress bar displays the current status and any errors with details. If the sync fails due to network or API issues, the system logs the error and offers a Retry button. When the sync completes, new SAP stock and goods receipt data appear in the Inventory listing.

### RFID Inbound Scanning
In the Delivery section under a tab labeled Inbound Scanning, warehouse staff connect their handheld RFID reader via a local middleware service. The page prompts the user to scan inbound items. As tags are read, the system validates each tag against the existing Purchase Order or goods receipt record. If a tag is unrecognized, a modal appears asking the user to assign a new RFID tag to a SKU. Once validation passes, the system updates the real stock and marks the scanned items as received. A summary shows the total scanned quantity versus the expected quantity, and a Save button finalizes the transaction, updating the stock database.

### RFID Outbound Dispatch
Under Delivery, the user selects an approved Delivery Order and clicks Outbound Scanning. The handheld reader captures RFID tags as items exit the warehouse. The system matches each tag to the delivery order line items. If there is a mismatch or missing tag, an error message appears and scanning can resume once resolved. When all tags match, the user signs off on the outbound scan and the system marks the order as Shipped. The user then clicks Send Proof of Delivery to trigger an email to the customer.

### Quotation Management
From the Quotation menu, Sales Reps click Create New Quote. They select a customer, pick tires and accessories from current stock, and enter pricing details. After saving, the quote appears in their Draft Quotes list. To submit for approval, the user clicks Submit and the system notifies a Manager. The Manager sees pending quotes in their Approval queue, clicks a quote to review line items, and chooses Approve or Reject. Once approved, the quote status changes to Approved and a Create Sales Order button appears, linking to the Delivery flow or to conversion into a customer Purchase Order if issued externally.

### Delivery Management
In the Delivery module, the user clicks New Delivery Order, selects an Approved Quote, chooses a shipping date, and assigns a delivery vehicle. This creates a Delivery Order record with a unique DO number. On the scheduled date, warehouse staff use the Outbound Dispatch flow. After scanning, the system requests an electronic signature by sending the customer an email with a secure link. The customer reviews the delivery details, signs online, and submits. The system marks the POD as Complete and attaches the signed document to the Delivery Order.

### Billing Management
The Billing menu shows Delivered Orders awaiting billing. The Billing Clerk clicks View Billing List to see orders with completed PODs. The clerk reviews each record, adds any internal notes, and flags it as Ready for SAP. When all records are flagged, the user clicks Export to SAP. A CSV file containing order details is generated for import into SAP’s invoicing. The system captures the export timestamp and shows a confirmation message once the file is downloaded.

### Admin Panel
Users with Admin role navigate to Admin, where they manage Users, Roles, Warehouses, and Reorder Settings. In Users, the admin views a list of all accounts, clicks Add User to create new accounts, assigns roles, and sets password policies. In Roles, the admin defines permissions for each module. Warehouses allows adding or editing warehouse locations and setting two reorder thresholds per SKU. All changes are saved and take effect immediately across the system.

### Reporting and Audit Trail
Under Reports, the user selects Daily Stock Report, Quote Pipeline, Delivery Status, or Billing Summary. Each report opens on a new page showing tables and charts. Users can filter by date range or warehouse and export reports as PDF or Excel. The Audit Trail page shows a chronological list of key user actions such as scans, transfers, quote submissions, approvals, and exports. The list is searchable by user, action type, or date.

## Settings and Account Management
Clicking the profile icon in the header brings the user to Settings. Here they can update personal information such as name, email, and password. They can set notification preferences for email alerts on low stock, pending approvals, and completed deliveries. A link at the bottom of this page returns them to the dashboard. Notifications appear as in-app banners if enabled, and email alerts are sent based on the user’s preferences.

## Error States and Alternate Paths
If a user enters invalid login credentials, the login page displays an error message and prompts retry. During data entry, invalid fields are highlighted in red with explanatory text. If network connectivity is lost while syncing with SAP or scanning RFID, an offline banner appears and the system automatically retries when the connection returns. Restricted actions, such as a Sales Rep attempting to access the Admin panel, trigger an access denied page with a link back to the dashboard. Whenever an unrecoverable error occurs, the user sees a friendly error page with a Contact Support link.

## Conclusion and Overall App Journey
From initial sign-up through day-to-day operations, One Chitra guides each user role smoothly through their tasks. The Sales team creates and submits quotes, Managers approve them, Warehouse staff receive and dispatch goods with RFID validation, Customers sign off on deliveries, and Billing Clerks prepare records for SAP invoicing. Admins configure users, warehouses, and thresholds, while Reports and Audit Trails provide transparency. This end-to-end flow ensures real-time inventory accuracy, streamlined approval, and seamless handoff to SAP for final invoicing.

## ASCII Flowchart
```
      [Landing Page]
            |
     [Sign Up/Login]
            |
      [Dashboard Home]
            |
   +--------+--------+--------+
   |        |        |        |
[Inventory][Quotation][Delivery][Billing]
   |        |        |        |
[SAP Sync] [Create] [Inbound] [View List]
   |        |        |        |
[View Stock][Manager][Outbound][Export]
   |        |Approval|  POD    |
   +--------+--------+--------+
            |
         [Reports]
            |
       [Audit Trail]
            |
     [Admin Settings]
            |
        [Sign Out]
```