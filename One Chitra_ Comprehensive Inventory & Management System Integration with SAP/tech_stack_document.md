# One Chitra: Tech Stack Document

This document explains the technology choices behind One Chitra in everyday language. It shows why each tool or framework was picked and how they work together to deliver a smooth, reliable inventory and management system.

## 1. Frontend Technologies

We built the user interface—the part you see and click on—with modern web tools that focus on speed, responsiveness, and ease of use.

- **React.js**  
  A popular library for building interactive user interfaces in a clear, component-based way. It lets us break the UI into small pieces (components) that are easy to reuse and maintain.
- **Next.js**  
  A framework on top of React that adds server-side rendering (SSR) and routing. SSR means pages load faster and feel more responsive, and it helps with search engines (SEO).
- **Tailwind CSS**  
  A utility-first styling framework that gives us a consistent design system without writing a lot of custom CSS. It speeds up styling and keeps the look modern and uniform.
- **Headless UI** (optional)  
  A set of unstyled, accessible UI components (modals, dropdowns) that we style with Tailwind. It ensures keyboard navigation and screen-reader support.
- **Charting Library** (e.g., Chart.js or Recharts)  
  For dashboards and reports—displaying stock levels, low-stock alerts, and delivery status with clear charts.

These tools work together to deliver a clean, responsive interface that adapts to different screen sizes and provides immediate feedback on your actions.

## 2. Backend Technologies

The backend handles data management, business logic, and integrations with SAP and RFID hardware.

- **Node.js**  
  A JavaScript runtime that lets us run server code efficiently. It’s fast, event-driven, and has a large ecosystem of packages.
- **NestJS (or Express.js)**  
  A server framework on top of Node.js that gives structure (NestJS) or lightweight routing (Express). It organizes code into modules and controllers for inventory, quotation, delivery, billing, and admin.
- **PostgreSQL**  
  A reliable relational database for storing users, roles, warehouses, stock records, quotes, deliveries, and billing data.
- **TypeORM (or Sequelize)**  
  An Object-Relational Mapping (ORM) tool that makes database queries feel like working with JavaScript objects, reducing boilerplate and errors.
- **Authentication & Authorization**  
  - **JWT (JSON Web Tokens)** for stateless session management.  
  - **Passport.js** (Node) for handling login, signup, password resets, and role-based access control.
- **SAP Integration**  
  - **Axios** or **SAP Cloud SDK** to call the read-only SAP OData/REST API.  
  - Scheduled or on-demand pulls of stock and goods receipt data, with retry logic and error handling.
- **RFID Middleware Service**  
  A small Node.js service (or WebSocket gateway) running in the warehouse to receive data from handheld UHF RFID scanners, filter out duplicates, and forward valid reads to the main server in real time.
- **E-Signature Handling**  
  Integration with a lightweight e-signature SDK (for example, HelloSign) or an open-source PDF signing library, allowing customers to sign proof-of-delivery online.
- **Email Notifications**  
  - **Nodemailer** or a service like **SendGrid** for sending shipment notifications and e-signature links.

All these backend pieces cooperate to keep data accurate, ensure authorized access, and bridge One Chitra with external systems.

## 3. Infrastructure and Deployment

This section covers where One Chitra runs, how we deliver updates, and how we keep everything under version control.

- **Hosting Platform**  
  A customer-provided VPS (Virtual Private Server) running Ubuntu Linux.
- **Containerization**  
  **Docker** to package the frontend, backend, and middleware into isolated containers—making deployment consistent across environments.
- **Reverse Proxy**  
  **NGINX** to handle HTTPS/TLS, route traffic to the right containers, and serve static assets efficiently.
- **CI/CD Pipeline**  
  **GitHub Actions** to automate building, testing, and deploying containers whenever code is pushed to the main branch:
  - Runs unit and integration tests.  
  - Builds Docker images.  
  - Deploys to the VPS if tests pass.
- **Version Control**  
  **Git** (hosted on GitHub) for source code management, feature branches, pull requests, and code reviews.
- **Backups & Monitoring**  
  - Daily database backups (cron jobs).  
  - Simple log-based monitoring on VPS (e.g., using a tool like PM2 for process management).

These choices ensure reliable, repeatable deployments, easy rollbacks, and clear traceability of changes.

## 4. Third-Party Integrations

One Chitra connects to specialized services to extend functionality without reinventing the wheel.

- **SAP Read-Only API**  
  Pulls stock levels and goods-receipt data from the customer’s SAP system (ECC or S/4Hana) via REST/OData.
- **Handheld RFID Scanners**  
  UHF scanners (USB or Bluetooth) sending tag reads to the RFID middleware, which then feeds One Chitra in real time.
- **E-Signature Service**  
  A third-party SDK or API (HelloSign or similar) for capturing legally binding online signatures on delivery documents.
- **Email Delivery**  
  Nodemailer (SMTP) or SendGrid for sending delivery notifications and signature requests to customers.
- **PDF Generation**  
  A library like PDFKit to produce downloadable billing exports and POD documents.

These integrations enhance One Chitra by allowing real-world hardware use, smooth SAP data flow, and digital document signing without building each piece from scratch.

## 5. Security and Performance Considerations

We’ve built in measures to protect your data and keep the system running smoothly.

- **Security**  
  - HTTPS everywhere (managed by NGINX with TLS certificates).  
  - JWT authentication and Passport.js for secure login flows.  
  - Password hashing with bcrypt.  
  - Role-based access control to restrict modules (Inventory, Quotation, Admin, etc.) to authorized users.  
  - Regular updates of dependencies to address known vulnerabilities.  
  - Audit logging of all key actions (scans, transfers, approvals, exports).
- **Performance**  
  - Server-Side Rendering (Next.js) to reduce time-to-first-byte on key pages.  
  - Database indexing on frequently queried columns (SKU, warehouse, status flags).  
  - Caching SAP data pulls for a short period to limit API calls and improve response times.  
  - Docker container resource limits to avoid noisy-neighbor issues on the VPS.  
  - Retry logic with exponential backoff on external API calls (SAP, email service) to handle transient failures gracefully.

Together, these practices safeguard data privacy, meet compliance needs, and ensure a snappy user experience.

## 6. Conclusion and Overall Tech Stack Summary

One Chitra combines proven, open-source technologies that align with the project goals of accurate real-time inventory, smooth quote-to-invoice workflows, and seamless hand-off to SAP.

- Frontend: React, Next.js, Tailwind CSS for a modern, responsive UI.  
- Backend: Node.js, NestJS/Express, PostgreSQL, TypeORM for structured, reliable business logic.  
- Integrations: SAP read-only API, handheld RFID middleware, e-signature service, email & PDF generation.  
- Infrastructure: VPS, Docker, NGINX, GitHub Actions, Git for dependable deployments.  
- Security & Performance: HTTPS, JWT, role-based access, caching, indexing, retry strategies.

Unique aspects include real-time RFID scanning at warehouse gates, seamless comparison of SAP stock vs. actual stock, and an online proof-of-delivery process. Together, these choices ensure One Chitra is scalable, secure, and tailored to the needs of a tire distributor operating multiple warehouses alongside SAP.