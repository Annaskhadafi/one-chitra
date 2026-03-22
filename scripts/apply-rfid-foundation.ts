import "dotenv/config";
import { Client } from "pg";

const statements: Array<{ label: string; sql: string }> = [
    {
        label: "Add RFID product columns",
        sql: `
            ALTER TABLE public.products
                ADD COLUMN IF NOT EXISTS default_tracking_mode varchar(20) NOT NULL DEFAULT 'manual_only',
                ADD COLUMN IF NOT EXISTS serial_required boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS rfid_capable boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS allow_tag_reuse boolean NOT NULL DEFAULT false;
        `,
    },
    {
        label: "Create tracking_mode enum",
        sql: `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tracking_mode') THEN
                    CREATE TYPE tracking_mode AS ENUM ('manual_only', 'optional_rfid', 'required_rfid');
                END IF;
            END $$;
        `,
    },
    {
        label: "Create tracking_scope_type enum",
        sql: `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tracking_scope_type') THEN
                    CREATE TYPE tracking_scope_type AS ENUM ('category', 'product');
                END IF;
            END $$;
        `,
    },
    {
        label: "Create rfid_zone_type enum",
        sql: `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfid_zone_type') THEN
                    CREATE TYPE rfid_zone_type AS ENUM ('receiving', 'outbound', 'staging', 'rack', 'quarantine', 'service', 'desk');
                END IF;
            END $$;
        `,
    },
    {
        label: "Create rfid_device_type enum",
        sql: `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfid_device_type') THEN
                    CREATE TYPE rfid_device_type AS ENUM ('handheld_reader', 'desktop_encoder', 'fixed_reader', 'printer_encoder');
                END IF;
            END $$;
        `,
    },
    {
        label: "Create rfid_tag_status enum",
        sql: `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfid_tag_status') THEN
                    CREATE TYPE rfid_tag_status AS ENUM ('blank', 'active', 'damaged', 'lost', 'retired', 'locked');
                END IF;
            END $$;
        `,
    },
    {
        label: "Create inventory_unit_status enum",
        sql: `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_unit_status') THEN
                    CREATE TYPE inventory_unit_status AS ENUM ('draft', 'awaiting_tagging', 'received', 'in_stock', 'reserved', 'picked', 'in_transfer', 'shipped', 'returned', 'scrapped');
                END IF;
            END $$;
        `,
    },
    {
        label: "Create rfid_tag_binding_status enum",
        sql: `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfid_tag_binding_status') THEN
                    CREATE TYPE rfid_tag_binding_status AS ENUM ('active', 'replaced', 'unbound');
                END IF;
            END $$;
        `,
    },
    {
        label: "Create rfid_operation_type enum",
        sql: `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfid_operation_type') THEN
                    CREATE TYPE rfid_operation_type AS ENUM ('inbound', 'outbound', 'transfer_out', 'transfer_in', 'opname', 'find_tag', 'register_tag', 'replace_tag', 'reset_tag', 'verify_tag');
                END IF;
            END $$;
        `,
    },
    {
        label: "Create rfid_session_status enum",
        sql: `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfid_session_status') THEN
                    CREATE TYPE rfid_session_status AS ENUM ('open', 'completed', 'cancelled', 'error');
                END IF;
            END $$;
        `,
    },
    {
        label: "Create rfid_scan_result enum",
        sql: `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfid_scan_result') THEN
                    CREATE TYPE rfid_scan_result AS ENUM ('matched', 'unknown_tag', 'duplicate', 'wrong_warehouse', 'wrong_document', 'inactive_tag', 'manual_override');
                END IF;
            END $$;
        `,
    },
    {
        label: "Create rfid_exception_severity enum",
        sql: `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfid_exception_severity') THEN
                    CREATE TYPE rfid_exception_severity AS ENUM ('low', 'medium', 'high', 'critical');
                END IF;
            END $$;
        `,
    },
    {
        label: "Create rfid_exception_status enum",
        sql: `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfid_exception_status') THEN
                    CREATE TYPE rfid_exception_status AS ENUM ('open', 'investigating', 'resolved', 'ignored');
                END IF;
            END $$;
        `,
    },
    {
        label: "Create rfid_write_operation enum",
        sql: `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfid_write_operation') THEN
                    CREATE TYPE rfid_write_operation AS ENUM ('register', 'replace', 'unbind', 'reset', 'verify');
                END IF;
            END $$;
        `,
    },
    {
        label: "Create warehouse_rfid_settings",
        sql: `
            CREATE TABLE IF NOT EXISTS public.warehouse_rfid_settings (
                id serial PRIMARY KEY,
                warehouse_id integer NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
                is_enabled boolean NOT NULL DEFAULT false,
                default_tracking_mode tracking_mode NOT NULL DEFAULT 'manual_only',
                allow_manual_fallback boolean NOT NULL DEFAULT true,
                require_inbound_validation boolean NOT NULL DEFAULT false,
                require_outbound_validation boolean NOT NULL DEFAULT false,
                pilot_notes text,
                created_at timestamp NOT NULL DEFAULT now(),
                updated_at timestamp NOT NULL DEFAULT now(),
                CONSTRAINT warehouse_rfid_settings_warehouse_unique UNIQUE (warehouse_id)
            );
        `,
    },
    {
        label: "Create warehouse_tracking_policies",
        sql: `
            CREATE TABLE IF NOT EXISTS public.warehouse_tracking_policies (
                id serial PRIMARY KEY,
                warehouse_id integer NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
                scope_type tracking_scope_type NOT NULL,
                product_id integer REFERENCES public.products(id) ON DELETE CASCADE,
                category varchar(100),
                tracking_mode tracking_mode NOT NULL DEFAULT 'optional_rfid',
                allow_manual_fallback boolean NOT NULL DEFAULT true,
                serial_required boolean NOT NULL DEFAULT false,
                is_active boolean NOT NULL DEFAULT true,
                notes text,
                created_at timestamp NOT NULL DEFAULT now(),
                updated_at timestamp NOT NULL DEFAULT now()
            );
        `,
    },
    {
        label: "Create warehouse_zones",
        sql: `
            CREATE TABLE IF NOT EXISTS public.warehouse_zones (
                id serial PRIMARY KEY,
                warehouse_id integer NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
                zone_code varchar(50) NOT NULL,
                zone_name varchar(120) NOT NULL,
                zone_type rfid_zone_type NOT NULL DEFAULT 'receiving',
                is_active boolean NOT NULL DEFAULT true,
                notes text,
                created_at timestamp NOT NULL DEFAULT now(),
                updated_at timestamp NOT NULL DEFAULT now(),
                CONSTRAINT warehouse_zones_warehouse_zone_code_unique UNIQUE (warehouse_id, zone_code)
            );
        `,
    },
    {
        label: "Create rfid_devices",
        sql: `
            CREATE TABLE IF NOT EXISTS public.rfid_devices (
                id serial PRIMARY KEY,
                device_code varchar(100) NOT NULL UNIQUE,
                device_name varchar(150) NOT NULL,
                device_type rfid_device_type NOT NULL DEFAULT 'handheld_reader',
                warehouse_id integer REFERENCES public.warehouses(id) ON DELETE SET NULL,
                zone_id integer REFERENCES public.warehouse_zones(id) ON DELETE SET NULL,
                can_read boolean NOT NULL DEFAULT true,
                can_write boolean NOT NULL DEFAULT false,
                can_reset boolean NOT NULL DEFAULT false,
                is_active boolean NOT NULL DEFAULT true,
                metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
                last_seen_at timestamp,
                created_at timestamp NOT NULL DEFAULT now(),
                updated_at timestamp NOT NULL DEFAULT now()
            );
        `,
    },
    {
        label: "Create rfid_tags",
        sql: `
            CREATE TABLE IF NOT EXISTS public.rfid_tags (
                id serial PRIMARY KEY,
                epc varchar(128) NOT NULL UNIQUE,
                tid varchar(128) UNIQUE,
                tag_serial varchar(120),
                tag_type varchar(50) NOT NULL DEFAULT 'label',
                status rfid_tag_status NOT NULL DEFAULT 'blank',
                is_reusable boolean NOT NULL DEFAULT false,
                memory_material_number varchar(100),
                memory_serial_number varchar(150),
                last_seen_warehouse_id integer REFERENCES public.warehouses(id) ON DELETE SET NULL,
                last_seen_at timestamp,
                notes text,
                created_at timestamp NOT NULL DEFAULT now(),
                updated_at timestamp NOT NULL DEFAULT now()
            );
        `,
    },
    {
        label: "Create inventory_units",
        sql: `
            CREATE TABLE IF NOT EXISTS public.inventory_units (
                id serial PRIMARY KEY,
                product_id integer NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
                warehouse_id integer NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
                zone_id integer REFERENCES public.warehouse_zones(id) ON DELETE SET NULL,
                serial_number varchar(150),
                current_tag_id integer UNIQUE REFERENCES public.rfid_tags(id) ON DELETE SET NULL,
                tracking_mode tracking_mode NOT NULL DEFAULT 'manual_only',
                status inventory_unit_status NOT NULL DEFAULT 'draft',
                origin_document_type varchar(50),
                origin_document_id integer,
                last_movement_at timestamp,
                notes text,
                created_at timestamp NOT NULL DEFAULT now(),
                updated_at timestamp NOT NULL DEFAULT now(),
                CONSTRAINT inventory_units_serial_number_unique UNIQUE (serial_number)
            );
        `,
    },
    {
        label: "Create rfid_tag_bindings",
        sql: `
            CREATE TABLE IF NOT EXISTS public.rfid_tag_bindings (
                id serial PRIMARY KEY,
                rfid_tag_id integer NOT NULL REFERENCES public.rfid_tags(id) ON DELETE CASCADE,
                inventory_unit_id integer NOT NULL REFERENCES public.inventory_units(id) ON DELETE CASCADE,
                status rfid_tag_binding_status NOT NULL DEFAULT 'active',
                write_operation rfid_write_operation NOT NULL DEFAULT 'register',
                bound_by text REFERENCES public."user"(id),
                bound_at timestamp NOT NULL DEFAULT now(),
                unbound_by text REFERENCES public."user"(id),
                unbound_at timestamp,
                notes text,
                created_at timestamp NOT NULL DEFAULT now(),
                updated_at timestamp NOT NULL DEFAULT now()
            );
        `,
    },
    {
        label: "Create inventory_unit_events",
        sql: `
            CREATE TABLE IF NOT EXISTS public.inventory_unit_events (
                id serial PRIMARY KEY,
                inventory_unit_id integer NOT NULL REFERENCES public.inventory_units(id) ON DELETE CASCADE,
                product_id integer NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
                warehouse_id integer REFERENCES public.warehouses(id) ON DELETE SET NULL,
                zone_id integer REFERENCES public.warehouse_zones(id) ON DELETE SET NULL,
                rfid_tag_id integer REFERENCES public.rfid_tags(id) ON DELETE SET NULL,
                operation_type rfid_operation_type NOT NULL,
                document_type varchar(50),
                document_id integer,
                capture_method varchar(20) NOT NULL DEFAULT 'manual',
                reference_number varchar(100),
                quantity integer NOT NULL DEFAULT 1,
                notes text,
                metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
                created_by text REFERENCES public."user"(id),
                created_at timestamp NOT NULL DEFAULT now()
            );
        `,
    },
    {
        label: "Create rfid_scan_sessions",
        sql: `
            CREATE TABLE IF NOT EXISTS public.rfid_scan_sessions (
                id serial PRIMARY KEY,
                session_code varchar(100) NOT NULL UNIQUE,
                warehouse_id integer REFERENCES public.warehouses(id) ON DELETE SET NULL,
                zone_id integer REFERENCES public.warehouse_zones(id) ON DELETE SET NULL,
                device_id integer REFERENCES public.rfid_devices(id) ON DELETE SET NULL,
                operation_type rfid_operation_type NOT NULL,
                document_type varchar(50),
                document_id integer,
                capture_method varchar(20) NOT NULL DEFAULT 'rfid',
                status rfid_session_status NOT NULL DEFAULT 'open',
                manual_override_reason text,
                started_by text REFERENCES public."user"(id),
                started_at timestamp NOT NULL DEFAULT now(),
                ended_at timestamp,
                created_at timestamp NOT NULL DEFAULT now(),
                updated_at timestamp NOT NULL DEFAULT now()
            );
        `,
    },
    {
        label: "Create rfid_scan_events",
        sql: `
            CREATE TABLE IF NOT EXISTS public.rfid_scan_events (
                id serial PRIMARY KEY,
                session_id integer NOT NULL REFERENCES public.rfid_scan_sessions(id) ON DELETE CASCADE,
                epc varchar(128) NOT NULL,
                tid varchar(128),
                rfid_tag_id integer REFERENCES public.rfid_tags(id) ON DELETE SET NULL,
                inventory_unit_id integer REFERENCES public.inventory_units(id) ON DELETE SET NULL,
                product_id integer REFERENCES public.products(id) ON DELETE SET NULL,
                warehouse_id integer REFERENCES public.warehouses(id) ON DELETE SET NULL,
                zone_id integer REFERENCES public.warehouse_zones(id) ON DELETE SET NULL,
                scan_result rfid_scan_result NOT NULL DEFAULT 'unknown_tag',
                read_count integer NOT NULL DEFAULT 1,
                rssi numeric(10, 2),
                antenna varchar(50),
                first_seen_at timestamp NOT NULL DEFAULT now(),
                last_seen_at timestamp NOT NULL DEFAULT now(),
                raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
                created_at timestamp NOT NULL DEFAULT now()
            );
        `,
    },
    {
        label: "Create rfid_exceptions",
        sql: `
            CREATE TABLE IF NOT EXISTS public.rfid_exceptions (
                id serial PRIMARY KEY,
                warehouse_id integer REFERENCES public.warehouses(id) ON DELETE SET NULL,
                zone_id integer REFERENCES public.warehouse_zones(id) ON DELETE SET NULL,
                device_id integer REFERENCES public.rfid_devices(id) ON DELETE SET NULL,
                session_id integer REFERENCES public.rfid_scan_sessions(id) ON DELETE SET NULL,
                inventory_unit_id integer REFERENCES public.inventory_units(id) ON DELETE SET NULL,
                product_id integer REFERENCES public.products(id) ON DELETE SET NULL,
                rfid_tag_id integer REFERENCES public.rfid_tags(id) ON DELETE SET NULL,
                exception_type varchar(50) NOT NULL,
                severity rfid_exception_severity NOT NULL DEFAULT 'medium',
                status rfid_exception_status NOT NULL DEFAULT 'open',
                document_type varchar(50),
                document_id integer,
                reference_number varchar(100),
                notes text,
                metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
                resolved_by text REFERENCES public."user"(id),
                resolved_at timestamp,
                created_at timestamp NOT NULL DEFAULT now(),
                updated_at timestamp NOT NULL DEFAULT now()
            );
        `,
    },
    {
        label: "Create rfid_tag_write_sessions",
        sql: `
            CREATE TABLE IF NOT EXISTS public.rfid_tag_write_sessions (
                id serial PRIMARY KEY,
                device_id integer REFERENCES public.rfid_devices(id) ON DELETE SET NULL,
                warehouse_id integer REFERENCES public.warehouses(id) ON DELETE SET NULL,
                zone_id integer REFERENCES public.warehouse_zones(id) ON DELETE SET NULL,
                rfid_tag_id integer REFERENCES public.rfid_tags(id) ON DELETE SET NULL,
                inventory_unit_id integer REFERENCES public.inventory_units(id) ON DELETE SET NULL,
                operation_type rfid_write_operation NOT NULL,
                status rfid_session_status NOT NULL DEFAULT 'open',
                material_number varchar(100),
                serial_number varchar(150),
                payload jsonb NOT NULL DEFAULT '{}'::jsonb,
                requested_by text REFERENCES public."user"(id),
                executed_at timestamp,
                verified_at timestamp,
                notes text,
                created_at timestamp NOT NULL DEFAULT now(),
                updated_at timestamp NOT NULL DEFAULT now()
            );
        `,
    },
];

const main = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    await client.connect();

    try {
        for (const statement of statements) {
            await client.query(statement.sql);
            console.log(`OK: ${statement.label}`);
        }
    } finally {
        await client.end();
    }
};

main().catch((error) => {
    console.error("Failed to apply RFID foundation:", error);
    process.exitCode = 1;
});
