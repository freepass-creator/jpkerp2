'use client';

import Link from 'next/link';
import { useRecentCars } from '@/lib/hooks/useRecentCars';
import { useAuth } from '@/lib/auth/context';

export default function MobileHome() {
  const recent = useRecentCars();
  const { user } = useAuth();

  return (
    <div>
      <div className="m-title">jpkerp mobile</div>
      <div className="m-subtitle">
        {user?.displayName ?? user?.email ?? '현장 업무 · 촬영 · 입력'}
      </div>

      <div className="m-section-title">빠른 실행</div>
      <Link href="/m/ocr" className="m-list-item">
        <i className="ph ph-camera" />
        <div className="m-list-item-body">
          <div className="m-list-item-label">카메라로 문서 촬영</div>
          <div className="m-list-item-sub">면허증 · 보험증권 · 과태료 자동 인식</div>
        </div>
        <i className="ph ph-caret-right" style={{ fontSize: 14 }} />
      </Link>
      <Link href="/m/scan" className="m-list-item">
        <i className="ph ph-magnifying-glass" />
        <div className="m-list-item-body">
          <div className="m-list-item-label">차량 조회</div>
          <div className="m-list-item-sub">번호 입력 → 계약·이력 확인</div>
        </div>
        <i className="ph ph-caret-right" style={{ fontSize: 14 }} />
      </Link>
      <Link href="/m/todo" className="m-list-item">
        <i className="ph ph-check-square" />
        <div className="m-list-item-body">
          <div className="m-list-item-label">내 할 일</div>
          <div className="m-list-item-sub">미결업무 요약</div>
        </div>
        <i className="ph ph-caret-right" style={{ fontSize: 14 }} />
      </Link>

      {recent.list.length > 0 && (
        <>
          <div className="m-section-title">최근 차량</div>
          {recent.list.slice(0, 8).map((c) => (
            <Link key={c} href={`/m/scan?q=${encodeURIComponent(c)}`} className="m-list-item">
              <i className="ph ph-car" />
              <div className="m-list-item-body">
                <div className="m-list-item-label">{c}</div>
              </div>
              <i className="ph ph-caret-right" style={{ fontSize: 14 }} />
            </Link>
          ))}
        </>
      )}
    </div>
  );
}
