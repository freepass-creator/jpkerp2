'use client';

import { useAuth } from '@/lib/auth/context';
import { can, hasRole, type Policy } from '@/lib/auth/rbac';
import type { Role } from '@/lib/auth/context';

/**
 * 권한 체크 훅.
 * - `useCan('delete.master')` — 특정 정책
 * - `useCan({ minRole: 'admin' })` — 최소 역할
 */
export function useCan(check: Policy | { minRole: Role }): boolean {
  const { user } = useAuth();
  if (!user) return false;
  if (typeof check === 'string') return can(user.role, check);
  return hasRole(user.role, check.minRole);
}
