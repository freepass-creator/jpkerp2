/**
 * RBAC — 역할·권한 정책.
 * 기존 jpkerp role 구조 유지: superadmin > admin > manager > operator > staff > viewer.
 */

import type { Role } from './context';

/** 역할 서열 (높은 숫자 = 더 많은 권한) */
const ROLE_RANK: Record<string, number> = {
  superadmin: 100,
  admin: 80,
  manager: 60,
  operator: 40,
  staff: 30,
  viewer: 10,
  pending: 0,
};

export function roleRank(role?: string | null): number {
  return ROLE_RANK[role ?? ''] ?? 0;
}

/** 최소 역할 이상인지 (role이 min 이상 rank이면 true) */
export function hasRole(role: Role | null | undefined, min: Role | Role[]): boolean {
  if (!role) return false;
  if (Array.isArray(min)) return min.includes(role);
  return roleRank(role) >= roleRank(min);
}

/** 액션별 정책. `can(role, 'delete.contract')` 식 호출. */
export type Policy =
  | 'edit.master'        // 마스터 데이터 수정 (계약·고객·자산 등)
  | 'delete.master'      // 마스터 삭제
  | 'edit.event'         // 운영업무 이벤트 편집
  | 'export.csv'         // CSV 내보내기
  | 'admin.access'       // /admin/* 진입
  | 'admin.user'         // 직원·권한 관리
  | 'admin.finance'      // 법인카드·계좌 등
  | 'dev.access';        // /dev 도구

const POLICIES: Record<Policy, (role: Role) => boolean> = {
  'edit.master':   (r) => hasRole(r, 'operator'),
  'delete.master': (r) => hasRole(r, 'admin'),
  'edit.event':    (r) => hasRole(r, 'staff'),
  'export.csv':    (r) => hasRole(r, 'staff'),
  'admin.access':  (r) => hasRole(r, 'manager'),
  'admin.user':    (r) => hasRole(r, 'admin'),
  'admin.finance': (r) => hasRole(r, 'admin'),
  'dev.access':    (r) => hasRole(r, 'admin'),
};

export function can(role: Role | null | undefined, policy: Policy): boolean {
  if (!role) return false;
  return POLICIES[policy]?.(role) ?? false;
}

/** 경로별 요구 권한 — 라우트 가드에서 사용 */
export function policyForPath(path: string): Policy | null {
  if (path.startsWith('/admin/staff')) return 'admin.user';
  if (path.startsWith('/admin/card') || path.startsWith('/admin/account')) return 'admin.finance';
  if (path.startsWith('/admin/')) return 'admin.access';
  if (path.startsWith('/dev')) return 'dev.access';
  return null;
}
