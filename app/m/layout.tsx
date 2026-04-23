'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 모바일 레이아웃 — AuthProvider/Toaster 는 root Providers 에서 이미 주입됨 (중복 금지)

const TABS: Array<{ href: string; icon: string; label: string }> = [
  { href: '/m/upload', icon: 'ph-camera', label: '업로드' },
  { href: '/m/task', icon: 'ph-list-checks', label: '업무' },
  { href: '/m/scan', icon: 'ph-magnifying-glass', label: '조회' },
  { href: '/m/settings', icon: 'ph-gear', label: '설정' },
];

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="m-shell">
      <main className="m-main">{children}</main>
      <nav className="m-tabbar">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`m-tab ${active ? 'is-active' : ''}`}
            >
              <i className={`ph ${t.icon}`} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
