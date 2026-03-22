# Requirements Document

## Introduction

Enhancement untuk halaman AI Inventory Forecast yang bertujuan meningkatkan user experience, efisiensi operasional, dan kepercayaan terhadap prediksi AI melalui visualisasi data yang lebih baik, bulk processing, tracking akurasi, dan dashboard summary yang komprehensif.

Fitur yang ada saat ini:
- 3 tab utama: Predictive Replenishment, Dynamic Safety Stock, Customer Recommendation
- Integrasi dengan Groq AI API (model: qwen/qwen3-32b)
- Data dari SAP (zmc9StockSap untuk stok, salesRevenueSap untuk penjualan)
- Cache prediksi 24 jam
- UI menggunakan React dengan shadcn/ui components

Enhancement ini akan menambahkan kemampuan analitik, visualisasi, dan automation yang membuat fitur AI Inventory Forecast lebih powerful dan user-friendly.

## Glossary

- **AI_Forecast_System**: Sistem AI Inventory Forecast yang mengelola prediksi restock, safety stock, dan rekomendasi customer
- **Dashboard**: Halaman ringkasan yang menampilkan key metrics dan overview dari semua prediksi AI
- **Prediction_Chart**: Visualisasi grafik untuk menampilkan trend penjualan dan prediksi
- **Accuracy_Tracker**: Komponen yang melacak dan menampilkan akurasi prediksi AI dibandingkan dengan actual data
- **Bulk_Processor**: Fitur untuk memproses prediksi multiple products sekaligus
- **Export_Module**: Modul untuk mengekspor hasil prediksi ke format Excel atau PDF
- **Prediction_Record**: Record prediksi AI yang tersimpan di database (aiInventoryPredictions table)
- **SAP_Data**: Data stok dan penjualan dari sistem SAP (zmc9StockSap, salesRevenueSap)
- **Material_Number**: Kode unik produk/material dari SAP
- **Restock_Point**: Titik waktu atau level stok dimana restock harus dilakukan
- **Safety_Stock_Level**: Level stok minimum yang harus dijaga untuk mengantisipasi demand tak terduga
- **Actual_Sales**: Data penjualan aktual yang digunakan untuk membandingkan dengan prediksi
- **Prediction_Accuracy**: Persentase akurasi prediksi AI dibandingkan dengan actual sales
- **Cache_Duration**: Durasi cache prediksi (saat ini 24 jam)

## Requirements

### Requirement 1: Dashboard Summary dengan Key Metrics

**User Story:** Sebagai inventory manager, saya ingin melihat dashboard summary dengan key metrics, sehingga saya dapat dengan cepat memahami status inventory dan performa AI predictions tanpa harus membuka setiap tab.

#### Acceptance Criteria

1. THE AI_Forecast_System SHALL menampilkan Dashboard sebagai halaman default atau tab pertama
2. THE Dashboard SHALL menampilkan total jumlah prediksi yang dibuat dalam 7 hari terakhir
3. THE Dashboard SHALL menampilkan total jumlah prediksi yang dibuat dalam 30 hari terakhir
4. THE Dashboard SHALL menampilkan breakdown prediksi berdasarkan tipe (Replenishment, Safety Stock, Customer Recommendation)
5. THE Dashboard SHALL menampilkan top 10 products dengan rekomendasi restock tertinggi
6. THE Dashboard SHALL menampilkan jumlah products yang mendekati restock point (stok < 20% dari recommended stock)
7. THE Dashboard SHALL menampilkan average prediction accuracy untuk bulan berjalan
8. THE Dashboard SHALL menyediakan quick action buttons untuk navigate ke setiap tab prediksi
9. THE Dashboard SHALL auto-refresh setiap 5 menit untuk menampilkan data terbaru
10. WHEN user clicks pada metric card, THE AI_Forecast_System SHALL navigate ke detail view yang relevan

### Requirement 2: Visualisasi Trend Penjualan dan Prediksi

**User Story:** Sebagai inventory analyst, saya ingin melihat visualisasi grafik dari trend penjualan historis dan prediksi, sehingga saya dapat lebih mudah memahami pola penjualan dan validitas prediksi AI.

#### Acceptance Criteria

1. WHEN user melakukan prediksi untuk suatu product, THE AI_Forecast_System SHALL menampilkan Prediction_Chart dengan historical sales data
2. THE Prediction_Chart SHALL menampilkan sales trend minimal 6 bulan terakhir dalam format line chart
3. THE Prediction_Chart SHALL menampilkan recommended stock level sebagai horizontal line pada chart
4. THE Prediction_Chart SHALL menampilkan current stock level sebagai marker pada chart
5. THE Prediction_Chart SHALL menampilkan projected restock point pada timeline
6. WHERE historical sales data tersedia, THE Prediction_Chart SHALL menampilkan moving average (3-month MA) sebagai trend line
7. THE Prediction_Chart SHALL responsive dan dapat di-zoom untuk melihat detail periode tertentu
8. THE Prediction_Chart SHALL menampilkan tooltip dengan detail data saat user hover pada data point
9. THE AI_Forecast_System SHALL menggunakan library charting yang ringan (seperti recharts atau chart.js)
10. THE Prediction_Chart SHALL dapat di-export sebagai image (PNG)

### Requirement 3: Historical Accuracy Tracking

**User Story:** Sebagai inventory manager, saya ingin melacak akurasi prediksi AI dibandingkan dengan actual sales, sehingga saya dapat mengevaluasi performa AI dan meningkatkan kepercayaan terhadap rekomendasi.

#### Acceptance Criteria

1. THE AI_Forecast_System SHALL menyimpan actual sales data untuk setiap prediction record
2. WHEN prediction berusia lebih dari 30 hari, THE Accuracy_Tracker SHALL menghitung prediction accuracy dengan membandingkan recommended stock vs actual sales
3. THE Accuracy_Tracker SHALL menampilkan accuracy percentage untuk setiap prediction record
4. THE Accuracy_Tracker SHALL menggunakan formula: Accuracy = 100 - ABS((Predicted - Actual) / Actual * 100)
5. THE Dashboard SHALL menampilkan overall accuracy rate untuk semua predictions
6. THE Accuracy_Tracker SHALL menampilkan accuracy trend chart untuk 6 bulan terakhir
7. THE AI_Forecast_System SHALL menampilkan color-coded indicator untuk accuracy level (hijau: >80%, kuning: 60-80%, merah: <60%)
8. WHERE accuracy < 60%, THE AI_Forecast_System SHALL menampilkan warning message dan saran untuk review prediction parameters
9. THE Accuracy_Tracker SHALL dapat di-filter berdasarkan product category atau material group
10. THE AI_Forecast_System SHALL menyimpan accuracy data di database untuk historical analysis

### Requirement 4: Bulk Prediction untuk Multiple Products

**User Story:** Sebagai inventory planner, saya ingin melakukan prediksi untuk multiple products sekaligus, sehingga saya dapat menghemat waktu dan mendapatkan overview lengkap untuk kategori produk tertentu.

#### Acceptance Criteria

1. THE AI_Forecast_System SHALL menyediakan Bulk_Processor interface pada setiap tab prediksi
2. THE Bulk_Processor SHALL menerima input berupa list of Material_Numbers (comma-separated atau file upload CSV)
3. WHEN user uploads CSV file, THE Bulk_Processor SHALL validate format file dan menampilkan preview data
4. THE Bulk_Processor SHALL memproses maksimal 50 products dalam satu batch
5. WHEN bulk prediction dimulai, THE Bulk_Processor SHALL menampilkan progress bar dengan status untuk setiap product
6. THE Bulk_Processor SHALL memproses predictions secara sequential dengan delay 2 detik antar request untuk menghindari rate limiting
7. IF satu prediction gagal, THE Bulk_Processor SHALL melanjutkan ke product berikutnya dan mencatat error
8. WHEN bulk prediction selesai, THE AI_Forecast_System SHALL menampilkan summary report dengan jumlah success dan failed predictions
9. THE Bulk_Processor SHALL menyimpan bulk prediction results ke database dengan batch identifier
10. THE AI_Forecast_System SHALL menyediakan option untuk download bulk prediction results sebagai Excel file
11. WHERE cache exists untuk suatu product, THE Bulk_Processor SHALL menggunakan cached data dan menandai sebagai "from cache"

### Requirement 5: Export Functionality untuk Reporting

**User Story:** Sebagai inventory manager, saya ingin mengekspor hasil prediksi ke Excel atau PDF, sehingga saya dapat membagikan report ke stakeholders dan menyimpan dokumentasi untuk audit.

#### Acceptance Criteria

1. THE AI_Forecast_System SHALL menyediakan Export_Module dengan button "Export" pada setiap tab
2. THE Export_Module SHALL menyediakan pilihan format export: Excel (.xlsx) dan PDF
3. WHEN user memilih Excel export, THE Export_Module SHALL generate file dengan sheets terpisah untuk setiap prediction type
4. THE Excel export SHALL mencakup kolom: Material Number, Product Name, Current Stock, Recommended Stock, Rationale, Prediction Date, Accuracy (jika tersedia)
5. WHEN user memilih PDF export, THE Export_Module SHALL generate formatted PDF dengan company header dan timestamp
6. THE PDF export SHALL mencakup summary statistics di halaman pertama
7. THE PDF export SHALL mencakup detail predictions dengan formatting yang rapi dan readable
8. THE Export_Module SHALL dapat export filtered data berdasarkan date range atau product category
9. THE Export_Module SHALL menampilkan loading indicator selama proses export
10. WHEN export selesai, THE AI_Forecast_System SHALL auto-download file dengan naming convention: "AI_Forecast_[Type]_[Date].xlsx"
11. THE Export_Module SHALL menggunakan library seperti xlsx atau exceljs untuk Excel generation
12. THE Export_Module SHALL menggunakan library seperti jsPDF atau react-pdf untuk PDF generation

### Requirement 6: Advanced Filters dan Search

**User Story:** Sebagai inventory analyst, saya ingin memfilter dan mencari predictions berdasarkan berbagai kriteria, sehingga saya dapat fokus pada products atau categories yang spesifik.

#### Acceptance Criteria

1. THE AI_Forecast_System SHALL menyediakan filter panel pada history section di setiap tab
2. THE AI_Forecast_System SHALL menyediakan filter berdasarkan date range (Last 7 days, Last 30 days, Custom range)
3. THE AI_Forecast_System SHALL menyediakan filter berdasarkan material group atau product category
4. THE AI_Forecast_System SHALL menyediakan filter berdasarkan recommended stock range (Low: <100, Medium: 100-500, High: >500)
5. WHERE accuracy data tersedia, THE AI_Forecast_System SHALL menyediakan filter berdasarkan accuracy level
6. THE AI_Forecast_System SHALL menyediakan search box untuk mencari berdasarkan Material Number atau Product Name
7. WHEN user applies filter, THE AI_Forecast_System SHALL update history list dalam waktu kurang dari 1 detik
8. THE AI_Forecast_System SHALL menampilkan jumlah results yang match dengan filter criteria
9. THE AI_Forecast_System SHALL menyimpan filter preferences di browser localStorage
10. THE AI_Forecast_System SHALL menyediakan "Clear All Filters" button untuk reset semua filter

### Requirement 7: Comparison View untuk Prediksi vs Actual

**User Story:** Sebagai inventory manager, saya ingin membandingkan prediksi dengan actual sales dalam satu view, sehingga saya dapat mengevaluasi efektivitas prediksi dan membuat keputusan yang lebih baik.

#### Acceptance Criteria

1. THE AI_Forecast_System SHALL menyediakan Comparison View sebagai tab atau modal terpisah
2. THE Comparison View SHALL menampilkan side-by-side comparison antara predicted stock dan actual sales
3. THE Comparison View SHALL menampilkan variance percentage untuk setiap product
4. THE Comparison View SHALL menampilkan comparison chart (bar chart) untuk visualisasi perbedaan
5. WHERE variance > 30%, THE AI_Forecast_System SHALL highlight row dengan warning color
6. THE Comparison View SHALL dapat di-filter berdasarkan time period (monthly, quarterly)
7. THE Comparison View SHALL menampilkan summary statistics: Average Variance, Total Over-prediction, Total Under-prediction
8. THE Comparison View SHALL sortable berdasarkan variance, product name, atau date
9. THE Comparison View SHALL menyediakan drill-down capability untuk melihat detail prediction dan actual data
10. THE AI_Forecast_System SHALL auto-update comparison data setiap hari pada jam 00:00 dengan data sales terbaru dari SAP

### Requirement 8: Notification System untuk Restock Alerts

**User Story:** Sebagai inventory planner, saya ingin menerima notifikasi ketika ada products yang perlu di-restock, sehingga saya tidak melewatkan critical restock points.

#### Acceptance Criteria

1. THE AI_Forecast_System SHALL menyediakan notification panel di Dashboard
2. WHEN current stock < 20% dari recommended stock, THE AI_Forecast_System SHALL generate restock alert notification
3. THE AI_Forecast_System SHALL menampilkan notification badge dengan jumlah active alerts
4. THE notification panel SHALL menampilkan list of products yang memerlukan immediate attention
5. THE notification SHALL mencakup: Material Number, Product Name, Current Stock, Recommended Stock, Urgency Level
6. THE AI_Forecast_System SHALL mengkategorikan urgency level: Critical (<10%), High (10-20%), Medium (20-30%)
7. THE notification SHALL sortable berdasarkan urgency level
8. WHEN user clicks pada notification item, THE AI_Forecast_System SHALL navigate ke detail prediction page
9. THE AI_Forecast_System SHALL menyediakan "Mark as Acknowledged" action untuk setiap notification
10. THE AI_Forecast_System SHALL menyimpan notification history untuk audit trail
11. WHERE user has email configured, THE AI_Forecast_System SHALL send daily email digest untuk critical alerts

### Requirement 9: Customizable AI Parameters

**User Story:** Sebagai system administrator, saya ingin mengkustomisasi AI parameters seperti temperature dan model selection, sehingga saya dapat mengoptimalkan hasil prediksi sesuai dengan kebutuhan bisnis.

#### Acceptance Criteria

1. THE AI_Forecast_System SHALL menyediakan Settings page untuk AI configuration
2. THE Settings page SHALL accessible hanya untuk users dengan role "admin" atau "inventory_manager"
3. THE Settings page SHALL menyediakan option untuk memilih Groq AI model (qwen/qwen3-32b, llama-3.3-70b-versatile, mixtral-8x7b)
4. THE Settings page SHALL menyediakan slider untuk mengatur temperature parameter (range: 0.0 - 1.0)
5. THE Settings page SHALL menyediakan input untuk mengatur max_tokens (range: 1000 - 8192)
6. THE Settings page SHALL menyediakan option untuk mengatur Cache_Duration (12 hours, 24 hours, 48 hours)
7. THE Settings page SHALL menyediakan toggle untuk enable/disable thinking mode pada AI response
8. WHEN admin changes AI parameters, THE AI_Forecast_System SHALL save configuration ke database
9. THE AI_Forecast_System SHALL apply new parameters untuk predictions yang dibuat setelah perubahan
10. THE Settings page SHALL menampilkan preview/test functionality untuk mencoba parameters dengan sample data
11. THE Settings page SHALL menampilkan recommendation untuk optimal parameters berdasarkan historical accuracy
12. IF parameter changes mengakibatkan API error, THE AI_Forecast_System SHALL revert ke default parameters dan menampilkan error message

### Requirement 10: Performance Optimization dan Caching Strategy

**User Story:** Sebagai system user, saya ingin sistem yang responsive dan cepat, sehingga saya dapat bekerja dengan efisien tanpa menunggu loading yang lama.

#### Acceptance Criteria

1. THE AI_Forecast_System SHALL load Dashboard dalam waktu kurang dari 2 detik
2. THE AI_Forecast_System SHALL implement lazy loading untuk history list (pagination atau infinite scroll)
3. THE AI_Forecast_System SHALL cache SAP_Data queries untuk 1 jam untuk mengurangi database load
4. THE AI_Forecast_System SHALL implement debouncing pada search input dengan delay 400ms
5. THE AI_Forecast_System SHALL preload frequently accessed data saat user login
6. WHEN user switches tabs, THE AI_Forecast_System SHALL load tab content dalam waktu kurang dari 500ms
7. THE AI_Forecast_System SHALL implement optimistic UI updates untuk delete operations
8. THE AI_Forecast_System SHALL compress chart data untuk products dengan historical data > 12 months
9. THE AI_Forecast_System SHALL implement service worker untuk offline capability pada Dashboard view
10. THE AI_Forecast_System SHALL monitor dan log performance metrics untuk continuous optimization
11. WHERE database query takes > 3 seconds, THE AI_Forecast_System SHALL implement query optimization atau indexing
12. THE AI_Forecast_System SHALL implement rate limiting untuk Groq API calls (max 10 requests per minute per user)

