'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { getRtdb } from '@/lib/firebase/rtdb';

export type Role = 'superadmin' | 'admin' | 'manager' | 'operator' | 'staff' | 'viewer' | 'pending';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: Role;
  assignedPartners: string[];
  raw: FirebaseUser;
}

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

interface AuthCtx extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), async (fbUser) => {
      if (!fbUser) {
        setState({ user: null, loading: false, error: null });
        return;
      }
      try {
        // 기존 jpkerp users/{uid}에서 role·partner 로드
        const snap = await get(ref(getRtdb(), `users/${fbUser.uid}`));
        const data = (snap.val() || {}) as {
          role?: Role;
          name?: string;
          assigned_partners?: string[];
        };
        setState({
          user: {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: data.name || fbUser.displayName,
            role: data.role || 'staff',
            assignedPartners: Array.isArray(data.assigned_partners)
              ? data.assigned_partners
              : [],
            raw: fbUser,
          },
          loading: false,
          error: null,
        });
      } catch (err) {
        setState({
          user: {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
            role: 'staff',
            assignedPartners: [],
            raw: fbUser,
          },
          loading: false,
          error: (err as Error).message,
        });
      }
    });
    return unsub;
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      ...state,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      },
      signOut: async () => {
        await fbSignOut(getFirebaseAuth());
      },
    }),
    [state],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
