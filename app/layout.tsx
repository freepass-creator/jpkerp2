import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

// 폰트·아이콘·AG Grid 스타일 — 번들링 (CDN 의존 제거)
import 'pretendard/dist/web/static/pretendard-dynamic-subset.css';
import '@fontsource/exo-2/600.css';
import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/fill';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

export const metadata: Metadata = {
  title: 'JPK ERP',
  description: '장기렌터카 운영 시스템 · 차량 생애주기 중심',
  manifest: '/manifest.json',
  themeColor: '#1e293b',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
