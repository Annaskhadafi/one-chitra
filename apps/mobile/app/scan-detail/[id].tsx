import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";

interface ScanRecord {
    id: number;
    tagId: string;
    serialNumber?: string;
    category?: string;
    scanType: string;
    scannedAt: string;
    referenceNo?: string;
    notes?: string;
    product?: { materialDescription: string | null; materialNumber: string; brand: string | null; category: string };
    warehouse?: { name: string };
}

function Row({ label, value }: { label: string; value?: string | null }) {
    if (!value) return null;
    return (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value}</Text>
        </View>
    );
}

export default function ScanDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();

    const { data: allScans, isLoading } = useQuery({
        queryKey: ["scan-history-all"],
        queryFn: async () => {
            const res = await api.getScanHistory({ limit: 200 });
            return res.scans as ScanRecord[];
        },
    });

    const scan = allScans?.find((s) => String(s.id) === id);
    const isInbound = scan?.scanType === "INBOUND";

    if (isLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color="#3b82f6" />
            </View>
        );
    }

    if (!scan) {
        return (
            <View style={styles.center}>
                <Text style={styles.notFound}>Data tidak ditemukan</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            {/* Header Badge */}
            <View style={[styles.headerCard, { borderColor: isInbound ? "#22c55e" : "#f59e0b" }]}>
                <View style={[styles.typeBadge, { backgroundColor: isInbound ? "#166534" : "#78350f" }]}>
                    <Ionicons
                        name={isInbound ? "arrow-down-circle" : "arrow-up-circle"}
                        size={28} color={isInbound ? "#22c55e" : "#f59e0b"}
                    />
                    <Text style={[styles.typeText, { color: isInbound ? "#22c55e" : "#f59e0b" }]}>
                        {isInbound ? "BARANG MASUK" : "BARANG KELUAR"}
                    </Text>
                </View>
                <Text style={styles.scanId}>Scan #{scan.id}</Text>
                <Text style={styles.scanTime}>
                    {new Date(scan.scannedAt).toLocaleString("id-ID", {
                        dateStyle: "full", timeStyle: "short",
                    })}
                </Text>
            </View>

            {/* RFID Info */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Informasi RFID</Text>
                <Row label="Tag ID" value={scan.tagId} />
                {scan.serialNumber && <Row label="Serial Number" value={scan.serialNumber} />}
                {scan.category && <Row label="Kategori" value={scan.category} />}
            </View>

            {/* Produk */}
            {scan.product && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Produk</Text>
                    <Row label="Deskripsi" value={scan.product.materialDescription} />
                    <Row label="Material No." value={scan.product.materialNumber} />
                    <Row label="Brand" value={scan.product.brand} />
                    <Row label="Kategori" value={scan.product.category} />
                </View>
            )}

            {/* Gudang & Referensi */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Detail Transaksi</Text>
                <Row label="Gudang" value={scan.warehouse?.name} />
                <Row label="No. Referensi" value={scan.referenceNo} />
                <Row label="Catatan" value={scan.notes} />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0f172a" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
    notFound: { color: "#64748b", fontSize: 16 },
    headerCard: {
        margin: 16, backgroundColor: "#1e293b", borderRadius: 16, padding: 20,
        borderWidth: 1, alignItems: "center", gap: 8,
    },
    typeBadge: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 12 },
    typeText: { fontSize: 16, fontWeight: "800" },
    scanId: { color: "#64748b", fontSize: 13 },
    scanTime: { color: "#94a3b8", fontSize: 14, textAlign: "center" },
    card: {
        marginHorizontal: 16, marginBottom: 12, backgroundColor: "#1e293b",
        borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#334155",
    },
    cardTitle: { color: "#64748b", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
    row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#0f172a" },
    rowLabel: { color: "#64748b", fontSize: 13 },
    rowValue: { color: "#f1f5f9", fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },
});
