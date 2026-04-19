'use client';

import { usePathname } from 'next/navigation';
import { Panel, Workspace } from './panel';
import { MENU, iconClass, type MenuGroup, type MenuLink } from '@/lib/menu';

/** 경로 → 메뉴 라벨·아이콘 찾기 */
function findMenuInfo(pathname: string): { label: string; icon?: string } | null {
  for (const entry of MENU) {
    if ('href' in entry && entry.href === pathname) {
      return { label: entry.label, icon: entry.icon };
    }
    if ('group' in entry) {
      const g = entry as MenuGroup;
      for (const c of g.children) {
        if ('href' in c && c.href === pathname) {
          const link = c as MenuLink;
          return { label: link.label, icon: link.icon ?? g.icon };
        }
      }
    }
  }
  return null;
}

/**
 * 메뉴는 있지만 아직 구현 안 된 페이지용 임시 panel.
 * title/icon 안 주면 현재 경로를 MENU에서 찾아서 자동 표시.
 */
export function ComingSoonPanel({
  title,
  icon,
  message = '이 페이지는 아직 준비 중입니다',
}: {
  title?: string;
  icon?: string;
  message?: string;
}) {
  const pathname = usePathname();
  const info = findMenuInfo(pathname);
  const finalTitle = title ?? info?.label ?? pathname;
  const finalIcon = icon ?? (info?.icon ? iconClass(info.icon) : 'ph-hourglass');

  return (
    <Workspace layout="layout-1">
      <Panel icon={finalIcon} title={finalTitle} subtitle="준비 중">
        <div
          className="flex flex-col items-center justify-center gap-2 text-text-muted"
          style={{ height: '100%', minHeight: 240 }}
        >
          <i className={`ph ${finalIcon}`} style={{ fontSize: 48 }} />
          <div className="font-medium">{message}</div>
          <div className="text-xs">기존 jpkerp 페이지를 v2로 이식 중입니다</div>
        </div>
      </Panel>
    </Workspace>
  );
}
