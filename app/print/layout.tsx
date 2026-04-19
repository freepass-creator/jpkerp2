import type { Metadata } from 'next';
import { Providers } from '../providers';

export const metadata: Metadata = {
  title: '인쇄',
};

/**
 * 인쇄 전용 레이아웃 — 사이드바·상단바·탭바 없음.
 * @media print 스타일로 배경 투명 + 버튼 숨김.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="print-shell">{children}</div>
    </Providers>
  );
}
