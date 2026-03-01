import { z } from "zod";

export const rfidScanSchema = z.object({
    tagId: z.string().min(1, "Tag ID wajib diisi"),
    serialNumber: z.string().optional(),
    productId: z.number().int().positive().optional(),
    category: z.string().optional(),
    warehouseId: z.number().int().positive({ message: "Pilih gudang tujuan" }),
    scanType: z.enum(["INBOUND", "OUTBOUND"]),
    referenceNo: z.string().optional(),
    notes: z.string().optional(),
    deviceId: z.string().optional(),
});

// Schema dengan validasi serial number wajib jika TYRE
export const rfidScanWithTireSchema = rfidScanSchema.superRefine((data, ctx) => {
    if (data.category === "TYRE" && !data.serialNumber) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Serial Number wajib diisi untuk kategori Tire/Ban",
            path: ["serialNumber"],
        });
    }
});

export const mobileAuthSchema = z.object({
    email: z.string().email("Email tidak valid"),
    password: z.string().min(1, "Password wajib diisi"),
});

export type RfidScanInput = z.infer<typeof rfidScanSchema>;
export type MobileAuthInput = z.infer<typeof mobileAuthSchema>;
