import { create } from "zustand";

interface UIState {
  /** Controls the mobile nav drawer (desktop sidebar is always visible). */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
