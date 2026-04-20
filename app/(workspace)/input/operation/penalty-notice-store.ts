'use client';

import { create } from 'zustand';
import type { PenaltyParsed } from '@/lib/parsers/penalty';
import type { RtdbAsset, RtdbContract } from '@/lib/types/rtdb-entities';

export interface PenaltyWorkItem extends PenaltyParsed {
  id: string;
  fileName: string;
  fileDataUrl: string;
  fileSize: number;
  pageNumber?: number;        // PDF 페이지 번호
  _asset?: RtdbAsset | null;
  _contract?: RtdbContract | null;
  _contractor?: string;
  _saving?: boolean;
}

interface PenaltyStore {
  items: PenaltyWorkItem[];
  busy: boolean;
  add: (item: PenaltyWorkItem) => boolean; // notice_no 중복 시 false
  remove: (id: string) => void;
  update: (id: string, patch: Partial<PenaltyWorkItem>) => void;
  clear: () => void;
  setBusy: (b: boolean) => void;
}

export const usePenaltyStore = create<PenaltyStore>((set, get) => ({
  items: [],
  busy: false,
  add: (item) => {
    const dup = item.notice_no && get().items.some((i) => i.notice_no === item.notice_no);
    if (dup) return false;
    set((s) => ({ items: [...s.items, item] }));
    return true;
  },
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  update: (id, patch) => set((s) => ({
    items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
  })),
  clear: () => set({ items: [] }),
  setBusy: (busy) => set({ busy }),
}));
