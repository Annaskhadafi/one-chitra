CREATE INDEX IF NOT EXISTS idx_sales_orders_status_sales_date ON sales_orders (status, sales_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_status ON sales_orders (customer_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_sales_person_status ON sales_orders (sales_person_id, status);

CREATE INDEX IF NOT EXISTS idx_deliveries_status_scheduled_date ON deliveries (status, scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_sales_order_status ON deliveries (sales_order_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_by_status ON deliveries (created_by, status);

CREATE INDEX IF NOT EXISTS idx_quotations_status_quotation_date ON quotations (status, quotation_date DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_status ON quotations (customer_id, status);
CREATE INDEX IF NOT EXISTS idx_quotations_sales_person_status ON quotations (sales_person_id, status);
