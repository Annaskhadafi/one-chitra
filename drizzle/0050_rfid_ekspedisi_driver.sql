ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "ekspedisi" varchar(100);
ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "plat_truk" varchar(50);
ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "tujuan" varchar(255);
ALTER TABLE "rfid_scans" ADD COLUMN IF NOT EXISTS "nama_driver" varchar(100);
