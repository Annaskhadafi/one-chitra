# Backend Structure Document for One Chitra

## 1. Backend Architecture

One Chitra’s backend is built as a modular, service-oriented Node.js application using the NestJS framework (or Express.js for lighter modules). Each business area—inventory, quotations, deliveries, billing, admin—is organized into its own module. This pattern keeps code clear, reusable, and easy to maintain.

Key design choices:  
- **Modular Structure**: Separate modules for Inventory, RFID, SAP sync, Quotation, Delivery, Billing, and Admin.  
- **Framework**: NestJS provides a clear folder structure (controllers, services, modules).  
- **Service Layer**: Business logic lives in services; controllers only handle incoming requests and responses.  
- **Dependency Injection**: NestJS’s built-in DI makes testing and swapping implementations easy.

How it supports project goals:  
- **Scalability**: Adding new features (like mobile or external APIs) means creating new modules without touching existing code.  
- **Maintainability**: Clear separation of concerns, common interfaces, and shared libraries (for error handling, logging, validation).  
- **Performance**: Lightweight framework, asynchronous I/O in Node.js, and caching of frequent SAP data pulls.

## 2. Database Management

One Chitra uses PostgreSQL for all relational data. We interact with the database via an ORM (TypeORM or Sequelize), which lets us work with JavaScript objects instead of building raw SQL for every query.

Technologies:  
- PostgreSQL (relational database)  
- TypeORM (or Sequelize) for mapping tables to models

Data practices:  
- **Structured Tables**: Dedicated tables for users, roles, warehouses, products, stock levels, transfers, quotes, deliveries, billing records, and audit logs.  
- **Transactions**: Critical flows (e.g., stock update on RFID scan) use database transactions to ensure consistency.  
- **Indexes**: Key columns (SKU, warehouse_id, user_id, order_id) are indexed to speed up lookups.  
- **Backups**: Daily automated dumps via cron jobs, retained for 30 days.

## 3. Database Schema

### Human-Readable Schema Overview

- **users**: Stores login credentials and profile info.  
- **roles**: Defines Admin, Manager, Warehouse, Sales, Billing.  
- **warehouses**: Details of each warehouse location and reorder thresholds.  
- **products**: List of SKUs, descriptions, unit measures.  
- **stock_levels**: Current stock per warehouse, including SAP vs. real counts.  
- **inter_warehouse_transfers**: Records transfer requests between warehouses.  
- **sap_sync_logs**: Tracks each SAP data pull and its status.  
- **rfid_scans**: Logs individual RFID reads (inbound/outbound) with timestamps.  
- **quotations**: Headers for quotes (customer, status, creator).  
- **quotation_items**: Line items for each quote (SKU, quantity, price).  
- **quotation_approvals**: Records manager approvals or rejections.  
- **deliveries**: Delivery orders with schedule, status, POD link.  
- **delivery_items**: SKUs and quantities on each delivery.  
- **billing_records**: Entries prepared for SAP invoicing (exported flags).  
- **audit_logs**: User actions (scans, transfers, approvals, exports).

### SQL Schema (PostgreSQL)

```sql
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT REFERENCES roles(id),
  full_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE warehouses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(200),
  reorder_point_level1 INT DEFAULT 0,
  reorder_point_level2 INT DEFAULT 0
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  unit VARCHAR(50)
);

CREATE TABLE stock_levels (
  id SERIAL PRIMARY KEY,
  warehouse_id INT REFERENCES warehouses(id),
  product_id INT REFERENCES products(id),
  real_stock INT DEFAULT 0,
  sap_stock INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(warehouse_id, product_id)
);

CREATE TABLE inter_warehouse_transfers (
  id SERIAL PRIMARY KEY,
  from_warehouse INT REFERENCES warehouses(id),
  to_warehouse INT REFERENCES warehouses(id),
  product_id INT REFERENCES products(id),
  quantity INT NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  requested_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE sap_sync_logs (
  id SERIAL PRIMARY KEY,
  sync_type VARCHAR(50),
  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP,
  status VARCHAR(50),
  notes TEXT
);

CREATE TABLE rfid_scans (
  id SERIAL PRIMARY KEY,
  tag_id VARCHAR(100) NOT NULL,
  product_id INT REFERENCES products(id),
  warehouse_id INT REFERENCES warehouses(id),
  scan_type VARCHAR(10), -- 'INBOUND' or 'OUTBOUND'
  user_id INT REFERENCES users(id),
  scanned_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE quotations (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(200) NOT NULL,
  created_by INT REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'DRAFT',
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  approved_by INT REFERENCES users(id)
);

CREATE TABLE quotation_items (
  id SERIAL PRIMARY KEY,
  quotation_id INT REFERENCES quotations(id),
  product_id INT REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL
);

CREATE TABLE quotation_approvals (
  id SERIAL PRIMARY KEY,
  quotation_id INT REFERENCES quotations(id),
  approver_id INT REFERENCES users(id),
  decision VARCHAR(20), -- 'APPROVED' or 'REJECTED'
  decided_at TIMESTAMP DEFAULT NOW(),
  comments TEXT
);

CREATE TABLE deliveries (
  id SERIAL PRIMARY KEY,
  quotation_id INT REFERENCES quotations(id),
  delivery_date DATE,
  status VARCHAR(50) DEFAULT 'SCHEDULED',
  pod_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE delivery_items (
  id SERIAL PRIMARY KEY,
  delivery_id INT REFERENCES deliveries(id),
  product_id INT REFERENCES products(id),
  quantity INT NOT NULL
);

CREATE TABLE billing_records (
  id SERIAL PRIMARY KEY,
  delivery_id INT REFERENCES deliveries(id),
  status VARCHAR(50) DEFAULT 'PENDING',
  export_file VARCHAR(200),
  exported_at TIMESTAMP
);

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```  

## 4. API Design and Endpoints

One Chitra uses RESTful APIs. All endpoints require a valid JWT token except login and public health checks. We follow standard HTTP methods and status codes.

Key endpoint groups:

- **Authentication**  
  - `POST /auth/login` — User login, returns JWT token.  
  - `POST /auth/register` — (Admin only) Create user.  

- **Users & Roles (Admin only)**  
  - `GET /admin/users` — List users.  
  - `PATCH /admin/users/:id` — Update user role or status.  

- **Warehouses**  
  - `GET /warehouses` — List warehouses.  
  - `POST /warehouses` — Create warehouse.  
  - `PATCH /warehouses/:id` — Update reorder levels.  

- **Products & Inventory**  
  - `GET /products` — List SKUs.  
  - `GET /inventory/:warehouseId` — View stock levels.  
  - `POST /inventory/transfer` — Create inter-warehouse transfer.  

- **SAP Synchronization**  
  - `POST /sync/sap` — Trigger manual sync of stock and GR data.  
  - `GET /sync/logs` — View past sync results.  

- **RFID Scanning**  
  - `POST /rfid/inbound` — Submit inbound scan batch.  
  - `POST /rfid/outbound` — Submit outbound scan batch.  

- **Quotation Management**  
  - `GET /quotations` — List or filter quotes.  
  - `POST /quotations` — Create new quote.  
  - `PATCH /quotations/:id/submit` — Submit for approval.  
  - `POST /quotations/:id/approve` — Manager approval.  

- **Delivery Management**  
  - `POST /deliveries` — Create delivery from approved quote.  
  - `POST /deliveries/:id/scan-outbound` — Record outbound RFID tags.  
  - `POST /deliveries/:id/pod` — Upload e-signature or POD URL.  

- **Billing Management**  
  - `GET /billing` — List deliveries ready for billing.  
  - `POST /billing/export` — Generate export file for SAP.

## 5. Hosting Solutions

One Chitra runs on a customer-provided VPS (Ubuntu Linux). We containerize services using Docker, then use NGINX as a reverse proxy and load balancer.

Benefits:  
- **Reliability**: VPS with SLA from provider; daily backups.  
- **Scalability**: Docker containers can scale horizontally by running multiple instances behind NGINX.  
- **Cost-Effectiveness**: Full control over resources; no ongoing PaaS fees.

## 6. Infrastructure Components

- **NGINX**: Acts as HTTPS terminator (TLS), reverse proxy to backend containers, and static file server for frontend builds.  
- **Docker**: Isolates frontend, backend, and RFID middleware into containers for predictable deployments.  
- **Process Manager (PM2)**: Manages Node.js processes, restarts on failure, and provides basic metrics.  
- **Middleware Service**: A small Node.js/Socket or HTTP service in the warehouse that receives raw RFID reads, filters duplicates, and forwards valid scans.  
- **Email Service**: Nodemailer or SendGrid used by backend to send delivery notifications and e-signature links.  
- **File Storage**: Local or network-mounted storage for generated CSV/PDF exports of billing data and POD documents.

These components ensure high throughput, failover handling, and a smooth user experience.

## 7. Security Measures

- **Authentication & Authorization**  
  - JWT tokens over HTTPS for stateless sessions.  
  - Passport.js (JWT strategy) enforces role-based access on each endpoint.  
- **Password Security**  
  - Bcrypt hashing with salt for stored passwords.  
- **Data Encryption**  
  - TLS for all network traffic.  
  - At-rest encryption for backups.  
- **Input Validation & Sanitization**  
  - Use NestJS Pipes or Express middleware (Joi or class-validator) to prevent injection attacks.  
- **Audit Logging**  
  - Every key action (scan, transfer, quote approval, billing export) is written to audit_logs for compliance and troubleshooting.  
- **Rate Limiting & CORS**  
  - NGINX throttles excessive requests; backend enforces role-based CORS policies.

## 8. Monitoring and Maintenance

- **Monitoring Tools**  
  - PM2 monitoring for process health and CPU/memory usage.  
  - Log shipping (optional) to a central log aggregator or simple file-based rotation.  
- **Alerts**  
  - Email or Slack alerts on container crashes, failed SAP syncs, or repeated RFID errors.  
- **Backups & Recovery**  
  - Daily PostgreSQL dumps via cron, stored off-site for 30 days.  
  - Docker image rollbacks via Git tags in case of faulty deployments.
- **Maintenance Practices**  
  - Regular dependency updates and security patching.  
  - Monthly test restores of backups to ensure data integrity.  
  - Code reviews and automated tests in CI/CD pipeline (GitHub Actions) before deployment.

## 9. Conclusion and Overall Backend Summary

One Chitra’s backend is a clear, modular Node.js application serving inventory, quotation, delivery, and billing workflows. It integrates seamlessly with SAP via a read-only API, processes RFID scans in real time, and captures e-signatures for proof-of-delivery. Postgres provides reliable data storage, Docker and NGINX deliver consistent deployments on a VPS, and a solid security posture ensures user data remains protected. This structure aligns with the project’s goals of real-time accuracy, streamlined quote-to-invoice cycles, and low operational overhead, setting One Chitra apart as a robust warehouse management companion to SAP.