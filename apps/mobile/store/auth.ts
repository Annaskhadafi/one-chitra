import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { api } from "@/services/api";

interface User {
    id: string;
    name: string;
    email: string;
}

interface AuthState {
    token: string | null;
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    restoreSession: () => Promise<void>;
}

const TOKEN_KEY = "one_chitra_token";
const USER_KEY = "one_chitra_user";

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    isLoading: true,
    isAuthenticated: false,

    login: async (email: string, password: string) => {
        const res = await api.login(email, password);
        const { token, user } = res;

        await SecureStore.setItemAsync(TOKEN_KEY, token);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));

        api.setToken(token);
        set({ token, user, isAuthenticated: true });
    },

    logout: async () => {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
        api.clearToken();
        set({ token: null, user: null, isAuthenticated: false });
    },

    restoreSession: async () => {
        try {
            const token = await SecureStore.getItemAsync(TOKEN_KEY);
            const userStr = await SecureStore.getItemAsync(USER_KEY);

            if (token && userStr) {
                const user = JSON.parse(userStr) as User;
                api.setToken(token);
                set({ token, user, isAuthenticated: true, isLoading: false });
            } else {
                set({ isLoading: false });
            }
        } catch {
            set({ isLoading: false });
        }
    },
}));
