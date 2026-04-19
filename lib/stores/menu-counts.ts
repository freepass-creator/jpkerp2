'use client';

import { create } from 'zustand';

export interface MenuCounts {
  // 현황
  overdue: number;      // 미납
  idle: number;         // 휴차
  product: number;      // 상품대기
  expiring: number;     // 만기도래 (3개월)
  pending: number;      // 미결업무
  ignition: number;     // 시동제어
  operationTotal: number; // 통합리포트 (전체 자산)

  // 조회
  asset: number;
  loan: number;
  insurance: number;
  disposal: number;
  operation: number;   // 전체 이력 (이벤트)
  opContact: number;
  opDelivery: number;
  opMaint: number;
  opAccident: number;
  opWash: number;
  returnSchedule: number;
  contract: number;
  customer: number;
  billing: number;

  // 관리
  staff: number;
  member: number;
  vendor: number;
  card: number;
  account: number;
}

const EMPTY: MenuCounts = {
  overdue: 0, idle: 0, product: 0, expiring: 0, pending: 0, ignition: 0, operationTotal: 0,
  asset: 0, loan: 0, insurance: 0, disposal: 0,
  operation: 0, opContact: 0, opDelivery: 0, opMaint: 0, opAccident: 0, opWash: 0,
  returnSchedule: 0, contract: 0, customer: 0, billing: 0,
  staff: 0, member: 0, vendor: 0, card: 0, account: 0,
};

interface Store {
  counts: MenuCounts;
  setCounts: (c: Partial<MenuCounts>) => void;
}

export const useMenuCounts = create<Store>((set) => ({
  counts: EMPTY,
  setCounts: (c) => set((s) => ({ counts: { ...s.counts, ...c } })),
}));

/** href → count 매핑 헬퍼 */
export function countFor(href: string, counts: MenuCounts): number {
  const M: Record<string, keyof MenuCounts> = {
    '/status/operation': 'operationTotal',
    '/status/overdue': 'overdue',
    '/status/idle': 'idle',
    '/status/product': 'product',
    '/status/expiring': 'expiring',
    '/status/pending': 'pending',
    '/status/ignition': 'ignition',
    '/asset': 'asset',
    '/loan': 'loan',
    '/insurance': 'insurance',
    '/disposal': 'disposal',
    '/operation': 'operation',
    '/operation/contact': 'opContact',
    '/operation/delivery': 'opDelivery',
    '/operation/maint': 'opMaint',
    '/operation/accident': 'opAccident',
    '/operation/wash': 'opWash',
    '/return-schedule': 'returnSchedule',
    '/contract': 'contract',
    '/customer': 'customer',
    '/billing': 'billing',
    '/admin/staff': 'staff',
    '/admin/member': 'member',
    '/admin/vendor': 'vendor',
    '/admin/card': 'card',
    '/admin/account': 'account',
  };
  const key = M[href];
  return key ? counts[key] : 0;
}
