import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

interface ScanRecord {
    id: number;
    tagId: string;
    serialNumber?: string;
    category?: string;
    scanType: string;
    scannedAt: string;
    referenceNo?: string;
    product?: { materialDescription: string | null; materialNumber: string; category: string };
    warehouse?: { name: string };
}

type FilterType = "ALL" | "INBOUND" | "OUTBOUND";

export default function HistoryScreen() {
    const [filter, setFilter] = useState<FilterType>("ALL");

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["scan-history", filter],
        queryFn: async () => {
            const res = await api.getScanHistory({
                scanType: filter === "ALL" ? undefined : filter,
                limit: 100,
            });
            return res.scans as ScanRecord[];
        },
    });

    const scans = data ?? [];

    const renderItem = ({ item }: { item: ScanRecord }) => (
        <TouchableOpacity
            style={styles.item}
            onPress={() => router.navigate(`/scan-detail/${item.id}`)}
        >
            <View style={[
                styles.badge,
                { backgroundColor: item.scanType === "INBOUND" ? "#166534" : "#78350f" }
            ]}>
                <Ionicons
                    name={item.scanType === "INBOUND" ? "arrow-down" : "arrow-up"}
                    size={16} color="#fff"
                />
            </View>
            <View style={styles.info}>
                <Text style={styles.productName} numberOfLines={1}>
                    {item.product?.materialDescription ?? item.tagId}
                </Text>
                {item.serialNumber && (
                    <Text style={styles.sn}>SN: {item.serialNumber}</Text>
                )}
                <View style={styles.metaRow}>
                    {item.warehouse && (
                        <Text style={styles.meta}>📦 {item.warehouse.name}</Text>
                    )}
                    {item.referenceNo && (
                        <Text style={styles.meta}>📋 {item.referenceNo}</Text>
                    )}
                </View>
                <Text style={styles.time}>
                    {new Date(item.scannedAt).toLocaleString("id-ID")}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#64748b" />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Filter Chip */}
            <View style={styles.filterRow}>
                {(["ALL", "INBOUND", "OUTBOUND"] as FilterType[]).map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.chip, filter === f && styles.chipActive]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                            {f === "ALL" ? "Semua" : f === "INBOUND" ? "Masuk" : "Keluar"}
                        </Text>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn}>
                    <Ionicons name="refresh-outline" size={18} color="#64748b" />
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator color="#3b82f6" />
                </View>
            ) : scans.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="time-outline" size={40} color="#334155" />
                    <Text style={styles.empty}>Belum ada riwayat scan</Text>
                </View>
            ) : (
                <FlatList
                    data={scans}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 16, gap: 8 }}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0f172a" },
    filterRow: {
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#1e293b",
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: "#1e293b",
        borderWidth: 1,
        borderColor: "#334155",
    },
    chipActive: { backgroundColor: "#1d4ed8", borderColor: "#3b82f6" },
    chipText: { color: "#64748b", fontSize: 13, fontWeight: "600" },
    chipTextActive: { color: "#fff" },
    refreshBtn: { marginLeft: "auto", padding: 4 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
    empty: { color: "#64748b", fontSize: 14 },
    item: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1e293b",
        borderRadius: 12,
        padding: 14,
        gap: 12,
        borderWidth: 1,
        borderColor: "#334155",
    },
    badge: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    info: { flex: 1, gap: 2 },
    productName: { color: "#f1f5f9", fontSize: 14, fontWeight: "600" },
    sn: { color: "#60a5fa", fontSize: 12 },
    metaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    meta: { color: "#94a3b8", fontSize: 11 },
    time: { color: "#64748b", fontSize: 11, marginTop: 2 },
});
