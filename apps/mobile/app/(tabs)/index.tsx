import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { api } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";

interface ScanRecord {
    id: number;
    tagId: string;
    serialNumber?: string;
    category?: string;
    scanType: string;
    scannedAt: string;
    product?: { materialDescription: string | null; materialNumber: string };
    warehouse?: { name: string };
}

export default function HomeScreen() {
    const { user, logout } = useAuthStore();

    const { data, isLoading } = useQuery({
        queryKey: ["scan-today"],
        queryFn: async () => {
            const res = await api.getScanHistory({ limit: 5 });
            return res.scans as ScanRecord[];
        },
        refetchInterval: 30000,
    });

    const todayScans = data ?? [];
    const inbound = todayScans.filter((s) => s.scanType === "INBOUND").length;
    const outbound = todayScans.filter((s) => s.scanType === "OUTBOUND").length;

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Halo, {user?.name?.split(" ")[0]} 👋</Text>
                    <Text style={styles.subGreeting}>One Chitra RFID Scanner</Text>
                </View>
                <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                    <Ionicons name="log-out-outline" size={22} color="#64748b" />
                </TouchableOpacity>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { borderColor: "#22c55e" }]}>
                    <Ionicons name="arrow-down-circle" size={28} color="#22c55e" />
                    <Text style={[styles.statNumber, { color: "#22c55e" }]}>{inbound}</Text>
                    <Text style={styles.statLabel}>Barang Masuk</Text>
                </View>
                <View style={[styles.statCard, { borderColor: "#f59e0b" }]}>
                    <Ionicons name="arrow-up-circle" size={28} color="#f59e0b" />
                    <Text style={[styles.statNumber, { color: "#f59e0b" }]}>{outbound}</Text>
                    <Text style={styles.statLabel}>Barang Keluar</Text>
                </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Aksi Cepat</Text>
            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={[styles.actionCard, { backgroundColor: "#166534" }]}
                    onPress={() => router.navigate("/(tabs)/scan-in")}
                >
                    <Ionicons name="arrow-down-circle-outline" size={36} color="#22c55e" />
                    <Text style={styles.actionLabel}>Scan Masuk</Text>
                    <Text style={styles.actionSub}>RFID Barang Masuk Gudang</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionCard, { backgroundColor: "#78350f" }]}
                    onPress={() => router.navigate("/(tabs)/scan-out")}
                >
                    <Ionicons name="arrow-up-circle-outline" size={36} color="#f59e0b" />
                    <Text style={styles.actionLabel}>Scan Keluar</Text>
                    <Text style={styles.actionSub}>RFID Barang Keluar Gudang</Text>
                </TouchableOpacity>
            </View>

            {/* Recent Scans */}
            <Text style={styles.sectionTitle}>Scan Terakhir</Text>
            {isLoading ? (
                <Text style={styles.empty}>Memuat...</Text>
            ) : todayScans.length === 0 ? (
                <Text style={styles.empty}>Belum ada scan hari ini</Text>
            ) : (
                todayScans.map((scan) => (
                    <TouchableOpacity
                        key={scan.id}
                        style={styles.scanItem}
                        onPress={() => router.navigate(`/scan-detail/${scan.id}`)}
                    >
                        <View
                            style={[
                                styles.scanBadge,
                                { backgroundColor: scan.scanType === "INBOUND" ? "#166534" : "#78350f" },
                            ]}
                        >
                            <Text style={styles.scanBadgeText}>
                                {scan.scanType === "INBOUND" ? "IN" : "OUT"}
                            </Text>
                        </View>
                        <View style={styles.scanInfo}>
                            <Text style={styles.scanTag} numberOfLines={1}>
                                {scan.product?.materialDescription ?? scan.tagId}
                            </Text>
                            {scan.serialNumber && (
                                <Text style={styles.scanSub}>SN: {scan.serialNumber}</Text>
                            )}
                            <Text style={styles.scanTime}>
                                {new Date(scan.scannedAt).toLocaleString("id-ID")}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#64748b" />
                    </TouchableOpacity>
                ))
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
        marginTop: 8,
    },
    greeting: { fontSize: 20, fontWeight: "700", color: "#f1f5f9" },
    subGreeting: { fontSize: 13, color: "#64748b", marginTop: 2 },
    logoutBtn: { padding: 8 },
    statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
    statCard: {
        flex: 1,
        backgroundColor: "#1e293b",
        borderRadius: 14,
        padding: 16,
        alignItems: "center",
        borderWidth: 1,
        gap: 4,
    },
    statNumber: { fontSize: 28, fontWeight: "800" },
    statLabel: { fontSize: 12, color: "#94a3b8", textAlign: "center" },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#64748b",
        marginBottom: 10,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    actionRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
    actionCard: {
        flex: 1,
        borderRadius: 16,
        padding: 20,
        alignItems: "center",
        gap: 8,
    },
    actionLabel: { fontSize: 16, fontWeight: "700", color: "#f1f5f9" },
    actionSub: { fontSize: 11, color: "#cbd5e1", textAlign: "center" },
    scanItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1e293b",
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        gap: 12,
    },
    scanBadge: {
        width: 44,
        height: 44,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    scanBadgeText: { color: "#fff", fontWeight: "800", fontSize: 12 },
    scanInfo: { flex: 1 },
    scanTag: { color: "#f1f5f9", fontSize: 14, fontWeight: "600" },
    scanSub: { color: "#94a3b8", fontSize: 12, marginTop: 1 },
    scanTime: { color: "#64748b", fontSize: 11, marginTop: 2 },
    empty: { color: "#64748b", textAlign: "center", paddingVertical: 20 },
});
