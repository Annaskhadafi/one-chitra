import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Vibration,
} from "react-native";
import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useRfidScanner } from "@/hooks/useRfidScanner";
import { Ionicons } from "@expo/vector-icons";

interface Product {
    id: number;
    materialNumber: string;
    materialDescription: string | null;
    brand: string | null;
    category: string;
}

interface Warehouse { id: number; name: string; }

export default function ScanOutScreen() {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
    const [serialNumber, setSerialNumber] = useState("");
    const [referenceNo, setReferenceNo] = useState("");
    const [notes, setNotes] = useState("");
    const [lastTag, setLastTag] = useState("");
    const [scanSuccess, setScanSuccess] = useState(false);
    const rfidInputRef = useRef<TextInput>(null);

    const { data: warehouseData } = useQuery({
        queryKey: ["warehouses"],
        queryFn: async () => { const r = await api.getWarehouses(); return r.warehouses; },
    });
    const warehouses = warehouseData ?? [];

    const handleTagReceived = useCallback(async (tagId: string) => {
        setLastTag(tagId);
        Vibration.vibrate(100);
        try {
            const res = await api.searchProducts({ tagId });
            const prods = res.products as Product[];
            if (prods.length > 0) setSelectedProduct(prods[0]);
        } catch { /* tag belum terdaftar */ }
    }, []);

    const { tagId, isScanning, handleTextChange, startScanning } = useRfidScanner(handleTagReceived);

    const submitMutation = useMutation({
        mutationFn: async () => {
            if (!selectedWarehouse) throw new Error("Pilih gudang asal terlebih dahulu");
            if (!lastTag) throw new Error("Scan RFID terlebih dahulu");
            if (selectedProduct?.category === "TYRE" && !serialNumber) {
                throw new Error("Serial Number wajib diisi untuk Tire/Ban");
            }
            return api.submitScan({
                tagId: lastTag,
                serialNumber: serialNumber || undefined,
                productId: selectedProduct?.id,
                category: selectedProduct?.category,
                warehouseId: selectedWarehouse.id,
                scanType: "OUTBOUND",
                referenceNo: referenceNo || undefined,
                notes: notes || undefined,
            });
        },
        onSuccess: () => {
            setScanSuccess(true);
            Vibration.vibrate([0, 100, 50, 100]);
            setTimeout(() => {
                setScanSuccess(false);
                setLastTag(""); setSelectedProduct(null);
                setSerialNumber(""); setReferenceNo(""); setNotes("");
                startScanning(); rfidInputRef.current?.focus();
            }, 2000);
        },
        onError: (err: Error) => Alert.alert("Gagal", err.message),
    });

    const isTyre = selectedProduct?.category === "TYRE";

    return (
        <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
            <TextInput
                ref={rfidInputRef} style={styles.hiddenInput} value={tagId}
                onChangeText={handleTextChange} autoFocus caretHidden showSoftInputOnFocus={false}
            />

            {/* Scan Area */}
            <View style={styles.scanArea}>
                {scanSuccess ? (
                    <View style={styles.successBox}>
                        <Ionicons name="checkmark-circle" size={56} color="#f59e0b" />
                        <Text style={[styles.successText, { color: "#f59e0b" }]}>Scan Keluar Tersimpan!</Text>
                    </View>
                ) : lastTag ? (
                    <View style={styles.tagBox}>
                        <Ionicons name="wifi" size={28} color="#f59e0b" />
                        <Text style={styles.tagLabel}>Tag ID Terdeteksi</Text>
                        <Text style={styles.tagValue} numberOfLines={1}>{lastTag}</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.scanPrompt}
                        onPress={() => { startScanning(); rfidInputRef.current?.focus(); }}
                    >
                        <Ionicons name="radio-outline" size={48} color="#f59e0b" />
                        <Text style={[styles.scanPromptText, { color: "#f59e0b" }]}>
                            {isScanning ? "Siap Menerima Scan..." : "Tap untuk Aktifkan Scan"}
                        </Text>
                        <Text style={styles.scanHint}>Tekan trigger scanner atau input manual</Text>
                    </TouchableOpacity>
                )}
            </View>

            {selectedProduct && (
                <View style={styles.section}>
                    <View style={styles.productCard}>
                        <View style={[styles.categoryBadge, { backgroundColor: "#78350f" }]}>
                            <Text style={styles.categoryText}>{selectedProduct.category}</Text>
                        </View>
                        <Text style={styles.productName}>
                            {selectedProduct.materialDescription ?? selectedProduct.materialNumber}
                        </Text>
                        {selectedProduct.brand && <Text style={styles.productSub}>Brand: {selectedProduct.brand}</Text>}
                    </View>
                </View>
            )}

            {isTyre && (
                <View style={styles.section}>
                    <Text style={styles.label}>Serial Number Ban <Text style={styles.required}>*</Text></Text>
                    <TextInput style={styles.input} placeholder="Contoh: TIRE-2024-001"
                        placeholderTextColor="#475569" value={serialNumber} onChangeText={setSerialNumber}
                        autoCapitalize="characters" />
                </View>
            )}

            <View style={styles.section}>
                <Text style={styles.label}>Gudang Asal <Text style={styles.required}>*</Text></Text>
                <View style={styles.warehouseRow}>
                    {warehouses.map((wh) => (
                        <TouchableOpacity key={wh.id}
                            style={[styles.warehouseBtn, selectedWarehouse?.id === wh.id && styles.warehouseBtnActive]}
                            onPress={() => setSelectedWarehouse(wh)}>
                            <Text style={[styles.warehouseBtnText, selectedWarehouse?.id === wh.id && styles.warehouseBtnTextActive]}>
                                {wh.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>No. Referensi (DO/SO)</Text>
                <TextInput style={styles.input} placeholder="Contoh: DO-2024-001" placeholderTextColor="#475569"
                    value={referenceNo} onChangeText={setReferenceNo} autoCapitalize="characters" />
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Catatan</Text>
                <TextInput style={[styles.input, styles.textarea]} multiline numberOfLines={3}
                    placeholder="Kondisi barang, keterangan..." placeholderTextColor="#475569"
                    value={notes} onChangeText={setNotes} />
            </View>

            <TouchableOpacity
                style={[styles.submitBtn, (!lastTag || !selectedWarehouse || submitMutation.isPending) && styles.submitBtnDisabled]}
                onPress={() => submitMutation.mutate()}
                disabled={!lastTag || !selectedWarehouse || submitMutation.isPending}
            >
                {submitMutation.isPending ? <ActivityIndicator color="#fff" /> : (
                    <>
                        <Ionicons name="arrow-up-circle" size={20} color="#fff" />
                        <Text style={styles.submitText}>Simpan Barang KELUAR</Text>
                    </>
                )}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0f172a" },
    hiddenInput: { position: "absolute", opacity: 0, width: 1, height: 1 },
    scanArea: {
        margin: 16, backgroundColor: "#1e293b", borderRadius: 20, padding: 24,
        alignItems: "center", borderWidth: 2, borderColor: "#f59e0b", borderStyle: "dashed",
        minHeight: 160, justifyContent: "center",
    },
    scanPrompt: { alignItems: "center", gap: 8 },
    scanPromptText: { fontSize: 16, fontWeight: "600" },
    scanHint: { color: "#64748b", fontSize: 12 },
    tagBox: { alignItems: "center", gap: 6 },
    tagLabel: { color: "#94a3b8", fontSize: 13 },
    tagValue: { color: "#f59e0b", fontSize: 13, fontFamily: "monospace", fontWeight: "700" },
    successBox: { alignItems: "center", gap: 8 },
    successText: { fontSize: 18, fontWeight: "700" },
    section: { paddingHorizontal: 16, marginBottom: 16 },
    label: { color: "#94a3b8", fontSize: 13, marginBottom: 8, fontWeight: "600" },
    required: { color: "#f87171" },
    input: { backgroundColor: "#1e293b", borderWidth: 1, borderColor: "#334155", borderRadius: 10, padding: 12, color: "#f1f5f9", fontSize: 14 },
    textarea: { height: 80, textAlignVertical: "top" },
    productCard: { backgroundColor: "#1e293b", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#334155", gap: 4 },
    categoryBadge: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4 },
    categoryText: { color: "#fde68a", fontSize: 11, fontWeight: "700" },
    productName: { color: "#f1f5f9", fontSize: 15, fontWeight: "600" },
    productSub: { color: "#94a3b8", fontSize: 12 },
    warehouseRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    warehouseBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: "#1e293b", borderWidth: 1, borderColor: "#334155" },
    warehouseBtnActive: { backgroundColor: "#78350f", borderColor: "#f59e0b" },
    warehouseBtnText: { color: "#94a3b8", fontSize: 13 },
    warehouseBtnTextActive: { color: "#fff", fontWeight: "700" },
    submitBtn: { margin: 16, backgroundColor: "#78350f", borderRadius: 14, padding: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
    submitBtnDisabled: { opacity: 0.4 },
    submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
