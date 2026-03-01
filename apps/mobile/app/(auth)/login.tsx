import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuthStore();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Error", "Email dan password wajib diisi");
            return;
        }

        try {
            setLoading(true);
            await login(email, password);
            router.replace("/(tabs)");
        } catch (err: unknown) {
            Alert.alert("Login Gagal", err instanceof Error ? err.message : "Terjadi kesalahan");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <View style={styles.card}>
                {/* Logo / Title */}
                <View style={styles.header}>
                    <View style={styles.logoBox}>
                        <Text style={styles.logoText}>OC</Text>
                    </View>
                    <Text style={styles.title}>One Chitra RFID</Text>
                    <Text style={styles.subtitle}>Scan Barang Masuk & Keluar</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="email@perusahaan.com"
                        placeholderTextColor="#64748b"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#64748b"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Masuk</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0f172a",
        justifyContent: "center",
        paddingHorizontal: 24,
    },
    card: {
        backgroundColor: "#1e293b",
        borderRadius: 20,
        padding: 28,
        borderWidth: 1,
        borderColor: "#334155",
    },
    header: {
        alignItems: "center",
        marginBottom: 32,
    },
    logoBox: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: "#3b82f6",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12,
    },
    logoText: {
        fontSize: 24,
        fontWeight: "800",
        color: "#fff",
    },
    title: {
        fontSize: 22,
        fontWeight: "700",
        color: "#f1f5f9",
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: "#94a3b8",
    },
    form: {
        gap: 4,
    },
    label: {
        color: "#94a3b8",
        fontSize: 13,
        marginBottom: 6,
        marginTop: 12,
    },
    input: {
        backgroundColor: "#0f172a",
        borderWidth: 1,
        borderColor: "#334155",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: "#f1f5f9",
        fontSize: 15,
    },
    button: {
        backgroundColor: "#3b82f6",
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 24,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
});
