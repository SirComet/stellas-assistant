import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "./api";

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem("stella_token", token);
        set({ user, token });
      },
      clearAuth: () => {
        localStorage.removeItem("stella_token");
        set({ user: null, token: null });
      },
    }),
    {
      name: "stella-auth",
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);

interface UiState {
  sidebarCollapsed: boolean;
  aiPanelOpen: boolean;
  activeAiSession: string | null;
  toggleSidebar: () => void;
  toggleAiPanel: () => void;
  setAiSession: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  aiPanelOpen: false,
  activeAiSession: null,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleAiPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
  setAiSession: (id) => set({ activeAiSession: id }),
}));

interface BuilderState {
  selectedComponentId: string | null;
  previewMode: boolean;
  setSelectedComponent: (id: string | null) => void;
  togglePreview: () => void;
}

export const useBuilderStore = create<BuilderState>((set) => ({
  selectedComponentId: null,
  previewMode: false,
  setSelectedComponent: (id) => set({ selectedComponentId: id }),
  togglePreview: () => set((s) => ({ previewMode: !s.previewMode })),
}));
