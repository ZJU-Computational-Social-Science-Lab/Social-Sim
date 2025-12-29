import { create } from "zustand";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  user: Record<string, unknown> | null;
  hasRestored: boolean;
  setSession: (payload: {
    accessToken: string;
    refreshToken: string;
    user: Record<string, unknown>;
  }) => void;
  clearSession: () => void;
  restoreSession: () => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  user: null,
  hasRestored: false,
  setSession: ({ accessToken, refreshToken, user }) => {
    localStorage.setItem("socialsim4.access", accessToken);
    localStorage.setItem("socialsim4.refresh", refreshToken);
    localStorage.setItem("socialsim4.user", JSON.stringify(user));
    set({
      accessToken,
      refreshToken,
      user,
      isAuthenticated: true,
      hasRestored: true,
    });
  },
  clearSession: () => {
    localStorage.removeItem("socialsim4.access");
    localStorage.removeItem("socialsim4.refresh");
    localStorage.removeItem("socialsim4.user");
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, hasRestored: true });
  },
  updateTokens: (accessToken, refreshToken) => {
    const userRaw = localStorage.getItem("socialsim4.user");
    if (accessToken) {
      localStorage.setItem("socialsim4.access", accessToken);
    }
    if (refreshToken) {
      localStorage.setItem("socialsim4.refresh", refreshToken);
    }
    set((state) => ({
      accessToken,
      refreshToken,
      user: state.user ?? (userRaw ? JSON.parse(userRaw) : null),
      isAuthenticated: true,
      hasRestored: true,
    }));
  },
  restoreSession: () => {
    const access = localStorage.getItem("socialsim4.access");
    const refresh = localStorage.getItem("socialsim4.refresh");
    const userRaw = localStorage.getItem("socialsim4.user");
    if (!access || !refresh || !userRaw) {
      set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, hasRestored: true });
      return;
    }
    try {
      const user = JSON.parse(userRaw) as Record<string, unknown>;
      set({ accessToken: access, refreshToken: refresh, user, isAuthenticated: true, hasRestored: true });
    } catch (error) {
      console.error("Failed to parse stored user", error);
      localStorage.removeItem("socialsim4.access");
      localStorage.removeItem("socialsim4.refresh");
      localStorage.removeItem("socialsim4.user");
      set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, hasRestored: true });
    }
  },
}));
