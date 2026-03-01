import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerStyle: { backgroundColor: "#0f172a" },
                headerTintColor: "#f1f5f9",
                headerTitleStyle: { fontWeight: "700" },
                tabBarStyle: {
                    backgroundColor: "#1e293b",
                    borderTopColor: "#334155",
                    paddingBottom: 4,
                    height: 60,
                },
                tabBarActiveTintColor: "#3b82f6",
                tabBarInactiveTintColor: "#64748b",
                tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Dashboard",
                    tabBarLabel: "Home",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="home-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="scan-in"
                options={{
                    title: "Scan Masuk",
                    tabBarLabel: "Masuk",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="arrow-down-circle-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="scan-out"
                options={{
                    title: "Scan Keluar",
                    tabBarLabel: "Keluar",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="arrow-up-circle-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="history"
                options={{
                    title: "Riwayat Scan",
                    tabBarLabel: "Riwayat",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="time-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
