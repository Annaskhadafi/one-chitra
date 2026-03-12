ALTER TABLE "delivery_cost_request_items" DROP CONSTRAINT "delivery_cost_request_items_request_id_delivery_cost_requests_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_cost_request_items" DROP CONSTRAINT "delivery_cost_request_items_delivery_id_deliveries_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_opname_signatures" DROP CONSTRAINT "stock_opname_signatures_session_id_stock_opname_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "evhs_gi_records" ADD COLUMN "document_no" varchar(100);--> statement-breakpoint
ALTER TABLE "evhs_voucher_items" ADD COLUMN "pos" varchar(50);--> statement-breakpoint
ALTER TABLE "evhs_voucher_items" ADD COLUMN "unit_id" varchar(100);--> statement-breakpoint
ALTER TABLE "evhs_vouchers" ADD COLUMN "mrko_status" varchar(20) DEFAULT 'OPEN';--> statement-breakpoint
ALTER TABLE "evhs_vouchers" ADD COLUMN "sap_invoice_no" varchar(100);--> statement-breakpoint
ALTER TABLE "evhs_vouchers" ADD COLUMN "settled_date" timestamp;