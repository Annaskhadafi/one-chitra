import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";

const queryClient = new QueryClient();

export default function RootLayout() {
    const { isAuthenticated, isLoading, restoreSession } = useAuthStore();

    useEffect(() => {
        restoreSession();
    }, [restoreSession]);

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) {
                router.replace("/(auth)/login");
            }
        }
    }, [isAuthenticated, isLoading]);

    return (
        <QueryClientProvider client={queryClient}>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                    name="scan-detail/[id]"
                    options={{ headerShown: true, title: "Detail Scan", headerStyle: { backgroundColor: "#0f172a" }, headerTintColor: "#fff" }}
                />
            </Stack>
        </QueryClientProvider>
    );
}
