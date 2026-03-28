import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  authProvider: 'local' | 'google';
  hasPassword: boolean;
  avatar: string | null;
}

export interface AuthPayload extends AuthUser {
  token: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  login: (token: string, user: AuthUserInput) => void;
  logout: () => void;
  syncUser: (user: AuthUserInput) => void;
  syncRole: (role: 'USER' | 'ADMIN') => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isLoggedIn: false,
      isAdmin: false,

      login: (token, user) => {
        const normalizedUser = normalizeAuthUser(user);

        set({
          token,
          user: normalizedUser,
          isLoggedIn: Boolean(token),
          isAdmin: normalizedUser.role === 'ADMIN',
        });
      },

      logout: () => {
        set({ token: null, user: null, isLoggedIn: false, isAdmin: false });
      },

      syncUser: (user) => {
        const normalizedUser = normalizeAuthUser(user);

        set((state) => ({
          token: state.token,
          user: normalizedUser,
          isLoggedIn: Boolean(state.token),
          isAdmin: normalizedUser.role === 'ADMIN',
        }));
      },

      syncRole: (role) =>
        set((state) => ({
          user: state.user ? { ...state.user, role } : null,
          isAdmin: role === 'ADMIN',
        })),
    }),
    {
      name: 'nebula-auth',
      version: 2,
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<AuthState>) ?? {};
        const persistedToken = persisted.token ?? currentState.token;
        const persistedUser = persisted.user
          ? normalizeAuthUser(persisted.user)
          : null;

        return {
          ...currentState,
          ...persisted,
          token: persistedToken,
          user: persistedUser,
          isLoggedIn: Boolean(persistedToken),
          isAdmin: persistedUser?.role === 'ADMIN',
        };
      },
    },
  ),
);
