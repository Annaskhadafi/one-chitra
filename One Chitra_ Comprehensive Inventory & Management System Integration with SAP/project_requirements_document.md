# Project Requirements Document (PRD)

## 1. Project Overview
One Chitra is a web-based inventory and management system tailored for a tire distribution business that runs alongside an existing SAP environment. It unifies real-time stock tracking, multi-warehouse operations, RFID-based goods receipt and dispatch, quotation creation for sales, delivery management with online proof-of-delivery, and preliminary billing records. One Chitra pulls stock and goods‐receipt data from SAP via a read-only API, ensuring the warehouse team always sees current quantities. It also handles quotation and billing tasks that feed into SAP’s invoicing workflow.

The goal is to eliminate manual spreadsheets, reduce stock discrepancies, and accelerate the quote-to-invoice cycle. Success is measured by achieving over 99% stock accuracy across all warehouses, cutting quote preparation time by at least 50%, ensuring 100% captured proof-of-delivery, and seamless hand-off of billing data to SAP without modifying its core. The system will live on the client’s VPS and serve Admins, Managers, Warehouse Staff, Sales Reps, and Billing Clerks via a modern, responsive web portal.

## 2. In-Scope vs. Out-of-Scope

### In-Scope (Version 1)
- **User & Role Management:** Admin, Manager, Warehouse, Sales, Billing roles with role-based access control.  
- **Multi-Warehouse Inventory:** Real-time stock view per warehouse, inter-warehouse transfers, two-level reorder points.  
- **SAP Data Sync:** Read-only pull of SAP stock levels and goods receipt (GR) via existing API, scheduled or on-demand.  
- **RFID Scanning:** Handheld scanner integration at the central warehouse for inbound (GR) and outbound (Delivery) scans.  
- **Quotation Management:** Sales team (Supply Chain) creates tire & accessory quotes, manager approval workflow.  
- **Delivery Management:** Create delivery orders (DO), schedule shipments, scan outbound RFID tags, capture e-signature proof-of-delivery, email notification to customers.  
- **Billing Management:** Admin team inputs delivered orders into a billing list, review status flags, export data package for SAP invoicing.  
- **Dashboard & Reporting:** Stock discrepancy alerts, low-stock warnings, open quotes, pending deliveries, billing records.  
- **Audit Logging:** Track user actions (scans, moves, quote creation, delivery completion, billing input).

### Out-of-Scope (Phase 2+)
- Writing data back into SAP (invoicing, stock adjustments).  
- Mobile or native tablet apps (desktop browser only).  
- Carrier API integrations or automated route optimization.  
- Advanced tax, credit-terms, or pro-forma invoice calculations.  
- IoT sensors beyond handheld RFID (temperature, humidity).  
- AI-driven demand forecasting or predictive analytics.

## 3. User Flow

A user lands on the One Chitra web portal and logs in with their email and password. Depending on their role, they see a dashboard with a left-hand navigation menu (Inventory, Quotation, Delivery, Billing, Reports, Admin). The dashboard widgets show current SAP stock vs. real stock, low-stock alerts, recently created quotes, pending deliveries, and billing tasks. The Admin can add users, assign roles, and configure warehouses or reorder thresholds.

When a Sales Rep creates a quotation, they select a customer, pick items (tires & accessories) from current stock, apply pricing, and submit for Manager approval. Once approved, the Warehouse team checks stock levels—if sufficient, they schedule shipment. On the shipping day, staff scan items exiting the warehouse gate with RFID handheld scanners; the system matches tags to the delivery order. The customer receives an email with a link to e-sign the online Proof of Delivery (POD). Finally, the Billing Clerk views completed deliveries, adds entries to the billing list, and exports all necessary fields in a bundled file to be imported into SAP for formal invoicing.

## 4. Core Features

- **Authentication & Authorization**  
  - Email/password login, JWT tokens, role-based access control.  
- **Inventory Management**  
  - Multi-warehouse stock view, inter-warehouse transfer requests, two reorder levels per SKU.  
- **SAP Data Synchronization**  
  - Read stock & GR via REST/OData API. Manual or scheduled pulls, with error handling and retry logic.  
- **RFID Integration**  
  - Handheld scanner connectivity (USB/Bluetooth) or middleware, real-time inbound/outbound scan processing.  
- **Quotation Module**  
  - Create, edit, approve quotes (tires & accessories), status tracking.  
- **Delivery Module**  
  - Generate Delivery Orders, schedule pick-up dates, scan outbound RFID tags, capture e-signature POD, send automated email notifications.  
- **Billing Module**  
  - List delivered orders, manual data input, status flags, export billing data for SAP.  
- **Dashboards & Reports**  
  - Stock discrepancy alerts, low-stock warnings, quote pipeline, delivery status, billing summary.  
- **Audit Trail**  
  - Log all key user actions with timestamps and user IDs.

## 5. Tech Stack & Tools

- **Frontend:** React.js + Next.js (Server-Side Rendering for SEO & performance), CSS-in-JS or Tailwind for styling.  
- **Backend:** Node.js with Express.js or NestJS framework.  
- **Database:** PostgreSQL (relational), using an ORM like TypeORM or Sequelize.  
- **Authentication:** JWT via Passport.js (Node) over HTTPS.  
- **SAP Integration:** Axios or SAP Cloud SDK calling SAP OData/REST API.  
- **RFID Middleware:** Local Node service or WebSocket gateway to receive and parse scans from handheld readers.  
- **E-Signature:** Simple open-source PDF signing library or integrate a lightweight e-sign SDK (e.g., HelloSign).  
- **Hosting & Deployment:** VPS (Linux Ubuntu, NGINX reverse proxy), Docker for containerization.  
- **CI/CD:** GitHub Actions for automated build, test, and deploy.  
- **IDE & Plugins:** VS Code, ESLint, Prettier, (optional) Windsurf for AI-driven code suggestions.

## 6. Non-Functional Requirements

- **Performance:** Page load ≤ 2s; API endpoints respond within 200–300 ms under normal load.  
- **Scalability:** Support up to 100 concurrent users and 50,000 SKUs; design microservices/event-driven for future growth.  
- **Reliability & Uptime:** 99.9% uptime; database backups daily; retry logic on external API calls.  
- **Security:** HTTPS everywhere, OWASP Top 10 compliance, password hashing (bcrypt), role-based access control.  
- **Usability:** Intuitive UI, consistent components, responsive design for 1024×768 and above.  
- **Compliance:** GDPR-style data privacy (user data encryption at rest and in transit).

## 7. Constraints & Assumptions

- **Constraints:**  
  - Single VPS with limited CPU/memory.  
  - Read-only SAP API—no writebacks.  
  - RFID scans only in central warehouse; other sites rely on manual transfers.  
- **Assumptions:**  
  - SAP API endpoints are stable, and network latency is acceptable.  
  - Users have modern web browsers (Chrome, Edge).  
  - Handheld RFID scanners can send data to the local middleware service.

## 8. Known Issues & Potential Pitfalls

- **SAP API Rate Limits:** Might throttle frequent polling; mitigate with scheduled pulls and exponential backoff.  
- **Data Mismatch:** SKU codes between SAP and One Chitra must be synchronized; plan a one-time data mapping exercise.  
- **RFID Read Errors:** Tags may misread in dense metal environments; recommend occasional manual cycle counts and middleware filtering to remove duplicate reads.  
- **Network Outages:** Warehouse loses connectivity; implement local caching of scans and sync when back online.  
- **Legal Validity of E-Sign:** Ensure captured signatures meet local compliance; start with basic acceptance email flow and plan for full e-signature provider later.
