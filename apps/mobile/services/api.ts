const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.1:3000";

class ApiService {
    private token: string | null = null;

    setToken(token: string) {
        this.token = token;
    }

    clearToken() {
        this.token = null;
    }

    private async request<T>(
        path: string,
        options: RequestInit = {}
    ): Promise<T> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        };

        const res = await fetch(`${BASE_URL}${path}`, {
            ...options,
            headers,
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error ?? "Terjadi kesalahan");
        }

        return data as T;
    }

    // Auth
    async login(email: string, password: string) {
        return this.request<{ token: string; user: { id: string; name: string; email: string } }>(
            "/api/mobile/auth",
            {
                method: "POST",
                body: JSON.stringify({ email, password }),
            }
        );
    }

    // RFID Scan
    async submitScan(payload: {
        tagId: string;
        serialNumber?: string;
        productId?: number;
        category?: string;
        warehouseId: number;
        scanType: "INBOUND" | "OUTBOUND";
        referenceNo?: string;
        notes?: string;
        deviceId?: string;
    }) {
        return this.request<{ success: boolean; scan: unknown }>("/api/mobile/rfid/scan", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    async getScanHistory(params?: { scanType?: string; limit?: number }) {
        const qp = new URLSearchParams();
        if (params?.scanType) qp.set("scanType", params.scanType);
        if (params?.limit) qp.set("limit", String(params.limit));
        return this.request<{ scans: unknown[] }>(`/api/mobile/rfid/scan?${qp.toString()}`);
    }

    // Products
    async searchProducts(params: { q?: string; category?: string; tagId?: string }) {
        const qp = new URLSearchParams();
        if (params.q) qp.set("q", params.q);
        if (params.category) qp.set("category", params.category);
        if (params.tagId) qp.set("tagId", params.tagId);
        return this.request<{ products: unknown[] }>(`/api/mobile/products/search?${qp.toString()}`);
    }

    // Warehouses
    async getWarehouses() {
        return this.request<{ warehouses: { id: number; name: string; location?: string }[] }>(
            "/api/mobile/warehouses"
        );
    }
}

export const api = new ApiService();
