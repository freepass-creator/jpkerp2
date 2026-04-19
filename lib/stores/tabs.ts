import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TabEntity = {
  id: string;
  label: string;
  href: string;
  kind: 'dashboard' | 'asset' | 'contract' | 'customer' | 'billing' | 'misc';
};

interface TabStore {
  tabs: TabEntity[];
  activeId: string | null;
  open: (tab: TabEntity) => void;
  close: (id: string) => void;
  setActive: (id: string) => void;
}

export const useTabs = create<TabStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeId: null,
      open: (tab) =>
        set((state) => {
          const exists = state.tabs.find((t) => t.id === tab.id);
          return {
            tabs: exists ? state.tabs : [...state.tabs, tab],
            activeId: tab.id,
          };
        }),
      close: (id) =>
        set((state) => {
          const tabs = state.tabs.filter((t) => t.id !== id);
          const activeId =
            state.activeId === id
              ? (tabs[tabs.length - 1]?.id ?? null)
              : state.activeId;
          return { tabs, activeId };
        }),
      setActive: (id) => set({ activeId: id }),
    }),
    { name: 'jpk.tabs' },
  ),
);
