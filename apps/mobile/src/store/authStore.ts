import { create } from 'zustand';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  role: UserRole | null;
  userId: string | null;
  assignedNodeId: string | null;
  isFullTime: boolean;
  hydrated: boolean;
  setAuth: (params: { token: string; refreshToken: string; role: UserRole; userId: string; assignedNodeId: string; isFullTime: boolean }) => void;
  setHydrated: (value: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  refreshToken: null,
  role: null,
  userId: null,
  assignedNodeId: null,
  isFullTime: false,
  hydrated: false,
  setAuth: ({ token, refreshToken, role, userId, assignedNodeId, isFullTime }) => set({ token, refreshToken, role, userId, assignedNodeId, isFullTime }),
  setHydrated: (value) => set({ hydrated: value }),
  clearAuth: () => set({ token: null, refreshToken: null, role: null, userId: null, assignedNodeId: null, isFullTime: false })
}));
