# One Chitra Security Guidelines

## Table of Contents
1. [Introduction](#introduction)
2. [Core Security Principles](#core-security-principles)
3. [Authentication & Authorization](#authentication--authorization)
4. [Input Handling & Processing](#input-handling--processing)
5. [Data Protection & Privacy](#data-protection--privacy)
6. [Integration Security: SAP & RFID](#integration-security-sap--rfid)
7. [API & Service Security](#api--service-security)
8. [Web Application Security Hygiene](#web-application-security-hygiene)
9. [Infrastructure & Configuration Management](#infrastructure--configuration-management)
10. [Dependency Management & CI/CD](#dependency-management--ci-cd)
11. [Monitoring, Logging & Incident Response](#monitoring-logging--incident-response)

---

## 1. Introduction
This document defines security requirements and best practices for **One Chitra**, a web-based inventory, billing, delivery, and quotation management system integrated with SAP. It covers:
- Multi-warehouse inventory with RFID scanning
- Quotation workflows for sales
- Delivery management with e-signature proof-of-delivery
- Pre-SAP billing data preparation
- Read-only SAP API integration (stock & GR data)

All code and operations must follow a _secure by design_ approach and comply with industry standards (OWASP Top 10, PCI-DSS, GDPR).

## 2. Core Security Principles
- **Security by Design:** Integrate security from architecture through deployment.
- **Least Privilege:** Grant minimal rights to users, services, and database accounts.
- **Defense in Depth:** Apply multiple controls (network, host, application).
- **Fail Securely:** Default to safe states; do not expose sensitive data on errors.
- **Keep It Simple:** Favor clear, maintainable security controls.
- **Secure Defaults:** All features off or locked down until explicitly enabled.

## 3. Authentication & Authorization
- **User Authentication**  
  • Enforce strong password policy: minimum 12 characters, complexity rules, rotate periodically  
  • Hash with Argon2 or bcrypt + per-user salt  
  • Implement multi-factor authentication (MFA) for Admins and Managers  
- **Session & Token Management**  
  • Use JWT with short TTL (e.g., 15 min) plus refresh tokens in HttpOnly Secure cookies  
  • Protect against session fixation and replay by rotating tokens on login  
- **Role-Based Access Control (RBAC)**  
  • Define roles: Admin, Manager, Warehouse Staff, Sales Rep, Billing Clerk  
  • Enforce server-side checks on every endpoint and data operation  
  • Principle of least privilege: restrict endpoints by role  
- **Account Lockout & Monitoring**  
  • Lock account after repeated failed logins (e.g., 5 attempts) with exponential back-off  
  • Alert on suspicious login patterns (unusual IP, geo-location)

## 4. Input Handling & Processing
- **Validation & Sanitization**  
  • Validate all incoming data server-side (type, length, format, range)  
  • Use a strict allow-list for fields (no generic `JSON.parse` without schema)  
- **Injection Prevention**  
  • Use parameterized queries or ORM (TypeORM/Sequelize) for SQL  
  • Sanitize any shell or system calls (e.g., file imports)  
- **Output Encoding**  
  • Context-aware encoding for HTML, JavaScript, CSS, and URL contexts  
- **File Uploads**  
  • Restrict types & sizes, store outside webroot, scan for malware  
  • Sanitize file names to prevent path traversal  
- **Redirect & Forward Controls**  
  • Validate target URLs against allow-list to prevent open redirects

## 5. Data Protection & Privacy
- **Encryption in Transit & At Rest**  
  • Enforce TLS 1.2+ for all services (API, DB connections)  
  • Encrypt database volumes with AES-256 or stronger  
- **Database Security**  
  • Separate users: one read-only for SAP sync, one write-only for CRUD operations  
  • Grant minimal privileges (SELECT, INSERT, UPDATE, DELETE as needed)  
- **Secrets Management**  
  • Store secrets (DB credentials, API keys) in a vault (HashiCorp Vault, AWS Secrets Manager)  
  • Do not hard-code in source or environment files  
- **PII & Sensitive Data**  
  • Mask or redact sensitive fields (customer PII) in logs and error messages  
  • Ensure GDPR/CCPA compliance: data subject rights, retention policies

## 6. Integration Security: SAP & RFID
### SAP Integration
- **Read-Only API Access**  
  • Use OAuth 2.0 client credentials or mTLS—avoid Basic Auth  
  • Enforce IP allow-listing for SAP API endpoints  
  • Rate-limit calls to protect SAP (e.g., 10 reqs/sec)  
  • Validate and sanitize all SAP response payloads  

### RFID Scanning
- **Secure Channel**  
  • Authenticate middleware service and handheld scanners (certificates or tokens)  
  • Use TLS or SSH tunneled WebSocket connections for RFID events  
- **Tag Data Handling**  
  • Store only EPC on tags; keep product metadata in secure DB  
  • Filter out duplicate reads in middleware  
  • Implement local caching with tamper detection and sync on reconnect

## 7. API & Service Security
- **HTTPS Everywhere**  
  • NGINX reverse proxy enforces TLS with HSTS header  
- **Authentication & Authorization**  
  • All endpoints require valid JWT and role checks  
- **Rate Limiting & Throttling**  
  • Per-IP and per-user quotas to prevent DoS, brute force  
- **CORS Policy**  
  • Only allow trusted origins (company domain) with limited methods  
- **API Versioning**  
  • Prefix routes (`/v1/inventory`, `/v1/quotation`) and plan deprecation

## 8. Web Application Security Hygiene
- **Security Headers**  
  • Content-Security-Policy (CSP) to restrict script sources  
  • X-Frame-Options: DENY  
  • X-Content-Type-Options: nosniff  
  • Referrer-Policy: strict-origin-when-cross-origin  
- **CSRF Protection**  
  • Use anti-CSRF tokens for state-changing requests  
- **Secure Cookies**  
  • Set `HttpOnly`, `Secure`, and `SameSite=Strict` on session cookies  
- **Subresource Integrity (SRI)**  
  • Apply SRI hashes for any third-party scripts/styles

## 9. Infrastructure & Configuration Management
- **Server Hardening**  
  • Disable unused services and default accounts on VPS (Ubuntu)  
  • Keep OS and packages updated; apply security patches weekly  
- **Containerization**  
  • Docker images with minimal base OS (Alpine or Debian slim)  
  • Scan images for vulnerabilities (Trivy, Clair) before deployment  
- **Reverse Proxy & TLS**  
  • NGINX configured with TLS 1.3+, strong cipher suites  
  • Redirect HTTP to HTTPS, disable SSLv3/TLS 1.0–1.1  
- **File & Directory Permissions**  
  • Run services as non-root users, restrict write permissions to necessary volumes  
- **Disable Debug in Production**  
  • Turn off verbose logging and stack traces for end users

## 10. Dependency Management & CI/CD
- **Secure Dependencies**  
  • Vet libraries for maintenance status and known CVEs  
  • Lock versions with `package-lock.json` or `Pipfile.lock`  
- **Automated Scanning**  
  • Integrate SCA (e.g., Snyk, Dependabot) into CI pipeline  
  • Fail builds on high/critical vulnerabilities  
- **CI/CD Practices**  
  • GitHub Actions workflow: lint → unit tests → SCA scan → build → deploy  
  • Use separate deploy keys and read-only tokens for CI  

## 11. Monitoring, Logging & Incident Response
- **Audit Logging**  
  • Log all critical actions (user logins, RFID scans, stock updates, billing exports) with timestamps, user IDs, and source IPs  
  • Store logs in a centralized, tamper-evident system (ELK stack, CloudWatch)  
- **Alerting & Metrics**  
  • Track failed logins, sync errors, unusual data patterns  
  • Configure alerts (Slack, email) for security events  
- **Incident Response**  
  • Define a runbook: identification, containment, eradication, recovery, lessons learned  
  • Perform quarterly tabletop exercises  

---

Adherence to these guidelines will ensure that One Chitra remains secure, compliant, and resilient as it interfaces with SAP and manages critical inventory and billing workflows.