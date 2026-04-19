'use client';

import { create } from 'zustand';

/**
 * 운영업무 입력 페이지 내 공유 상태.
 * 폼(Panel2)에서 차량번호·일자 입력 → 컨텍스트(Panel3)에 이력 표시.
 */
interface OpContextStore {
  carNumber: string;
  date: string;
  setCarNumber: (v: string) => void;
  setDate: (v: string) => void;
  reset: () => void;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export const useOpContext = create<OpContextStore>((set) => ({
  carNumber: '',
  date: todayStr(),
  setCarNumber: (v) => set({ carNumber: v }),
  setDate: (v) => set({ date: v }),
  reset: () => set({ carNumber: '', date: todayStr() }),
}));
