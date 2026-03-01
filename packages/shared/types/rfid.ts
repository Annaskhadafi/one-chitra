// Shared types for RFID scanning — used by both web (Next.js) and mobile (RN)

export type ScanType = "INBOUND" | "OUTBOUND";

export type ProductCategory =
    | "TYRE"
    | "ACC"
    | "FLAP"
    | "IMT PART"
    | "Material Consumable"
    | "SPM"
    | "TUBE"
    | "WHEEL & RIM";

export interface RfidScanPayload {
    tagId: string;
    serialNumber?: string;        // Wajib untuk kategori TYRE
    productId?: number;
    category?: ProductCategory | string;
    warehouseId: number;
    scanType: ScanType;
    referenceNo?: string;         // Nomor DO/SO
    notes?: string;
    deviceId?: string;
}

export interface RfidScanRecord extends RfidScanPayload {
    id: number;
    scannedAt: string;            // ISO date string
    userId: string;
    product?: {
        id: number;
        materialDescription: string | null;
        materialNumber: string;
        brand: string | null;
        category: string;
    };
    warehouse?: {
        id: number;
        name: string;
    };
}

export interface ProductSearchResult {
    id: number;
    materialNumber: string;
    materialDescription: string | null;
    brand: string | null;
    category: string;
    imageUrl: string | null;
}

export interface WarehouseOption {
    id: number;
    name: string;
    location?: string | null;
}

export interface MobileAuthResponse {
    token: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
}
