'use client';

import { usePathname } from 'next/navigation';
import { UserMenu } from './user-menu';
import { ThemeToggle } from './theme-toggle';
import { NotificationBell } from './notification-bell';
import { SaveStatusIndicator } from './save-status-indicator';
import { MENU, type MenuGroup } from '@/lib/menu';

/**
 * 경로 → 브레드크럼 라벨 (메뉴에서 매칭)
 */
function breadcrumb(pathname: string): string[] {
  for (const entry of MENU) {
    if ('href' in entry && entry.href === pathname) return [entry.label];
    if ('group' in entry) {
      const g = entry as MenuGroup;
      for (const c of g.children) {
        // 서브그룹 자체가 링크인 경우 (개발 등)
        if ('subgroup' in c && c.href === pathname) return [g.group, c.subgroup];
        if ('href' in c && 'label' in c && c.href === pathname) return [g.group, c.label];
      }
    }
  }
  return [];
}

export function Topbar() {
  const pathname = usePathname();
  const crumbs = breadcrumb(pathname);

  return (
    <header className="topbar">
      <div style={{ flex: 1, minWidth: 0 }} />
      <div className="topbar-center">
        {crumbs.length > 0 && (
          <span className="text-text-sub">
            {crumbs.join(' > ')}
          </span>
        )}
      </div>
      <div className="topbar-actions">
        <SaveStatusIndicator />
        <ThemeToggle />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
