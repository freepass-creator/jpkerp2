'use client';

import Link from 'next/link';
import { useTabs } from '@/lib/stores/tabs';
import { cn } from '@/lib/utils';

export function TabBar() {
  const { tabs, activeId, close, setActive } = useTabs();

  if (tabs.length === 0) {
    return (
      <div
        className="border-t border-border bg-bg-sub flex items-center px-4"
        style={{ height: 'var(--tabbar-h)' }}
      >
        <span className="text-xs text-text-muted">
          작업을 시작하면 여기에 탭이 열립니다 · ⌘1~9로 전환
        </span>
      </div>
    );
  }

  return (
    <div
      className="border-t border-border bg-bg-sub flex items-center gap-0.5 px-2 overflow-x-auto scrollbar-thin"
      style={{ height: 'var(--tabbar-h)' }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            className={cn(
              'group h-6 flex items-center gap-1.5 px-2 text-xs cursor-pointer rounded-sm',
              active
                ? 'bg-surface text-text font-medium border border-border'
                : 'text-text-sub hover:bg-bg-hover',
            )}
            onClick={() => setActive(tab.id)}
            onKeyDown={(e) => e.key === 'Enter' && setActive(tab.id)}
          >
            <Link href={tab.href} className="flex-1 max-w-[160px] truncate">
              {tab.label}
            </Link>
            <button
              type="button"
              aria-label={`${tab.label} 탭 닫기`}
              className="opacity-0 group-hover:opacity-100 hover:bg-border rounded-xs p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                close(tab.id);
              }}
            >
              <i className="ph ph-x text-2xs" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
