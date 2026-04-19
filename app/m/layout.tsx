'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/auth/context';
import { Toaster } from 'sonner';

const TABS: Array<{ href: string; icon: string; label: string }> = [
  { href: '/m', icon: 'ph-house', label: '홈' },
  { href: '/m/scan', icon: 'ph-magnifying-glass', label: '조회' },
  { href: '/m/ocr', icon: 'ph-camera', label: 'OCR' },
  { href: '/m/todo', icon: 'ph-check-square', label: '할 일' },
];

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AuthProvider>
      <div className="m-shell">
        <main className="m-main">{children}</main>
        <nav className="m-tabbar">
          {TABS.map((t) => {
            const active = t.href === '/m' ? pathname === '/m' : pathname.startsWith(t.href);
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
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}
