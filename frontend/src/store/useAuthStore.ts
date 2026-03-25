import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  syncUser: (user: AuthUser) => void;
  syncRole: (role: 'USER' | 'ADMIN') => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isLoggedIn: false,
      isAdmin: false,

      login: (token, user) =>
        set({
          token,
          user,
          isLoggedIn: true,
          isAdmin: user.role === 'ADMIN',
        }),

      logout: () => {
        set({ token: null, user: null, isLoggedIn: false, isAdmin: false });
      },

      syncUser: (user) =>
        set((state) => ({
          token: state.token,
          user,
          isLoggedIn: Boolean(state.token),
          isAdmin: user.role === 'ADMIN',
        })),

      syncRole: (role) =>
        set((state) => ({
          user: state.user ? { ...state.user, role } : null,
          isAdmin: role === 'ADMIN',
        })),
    }),
    { name: 'nebula-auth', version: 1 },
  ),
);
