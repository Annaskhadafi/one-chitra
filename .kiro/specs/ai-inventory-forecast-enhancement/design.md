# Design Document: AI Inventory Forecast Enhancement

## Overview

Enhancement ini bertujuan untuk meningkatkan sistem AI Inventory Forecast yang sudah ada dengan menambahkan 10 fitur utama yang akan meningkatkan user experience, efisiensi operasional, dan kepercayaan terhadap prediksi AI.

### Current System

Sistem yang ada saat ini memiliki:
- 3 tipe prediksi: Predictive Replenishment, Dynamic Safety Stock, Customer Recommendation
- Integrasi dengan Groq AI API menggunakan model qwen/qwen3-32b
- Data source dari SAP (zmc9StockSap untuk stok, salesRevenueSap untuk penjualan)
- Cache prediksi 24 jam
- Database table: aiInventoryPredictions
- UI menggunakan React dengan shadcn/ui components

### Enhancement Goals

1. Dashboard Summary dengan Key Metrics - memberikan overview cepat dari semua prediksi
2. Visualisasi Trend Penjualan - grafik interaktif untuk memahami pola penjualan
3. Historical Accuracy Tracking - melacak akurasi prediksi vs actual sales
4. Bulk Prediction - memproses multiple products sekaligus
5. Export Functionality - ekspor ke Excel/PDF untuk reporting
6. Advanced Filters - filter dan search yang lebih powerful
7. Comparison View - membandingkan prediksi vs actual dalam satu view
8. Notification System - alert untuk restock yang urgent
9. Customizable AI Parameters - konfigurasi model dan parameters
10. Performance Optimization - caching strategy dan lazy loading

### Technology Stack

- **Frontend**: Next.js 14 App Router, React Server Components, React Client Components
- **UI Library**: shadcn/ui, Tailwind CSS, Lucide Icons
- **Charts**: Recharts (sudah digunakan di project)
- **Database**: PostgreSQL dengan Drizzle ORM
- **AI Service**: Groq AI API
- **Export Libraries**: xlsx/exceljs untuk Excel, jsPDF/react-pdf untuk PDF
- **State Management**: React hooks, Zustand (jika diperlukan)
- **Data Fetching**: Server Actions

