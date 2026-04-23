'use client';

import Link from 'next/link';

const OPERATIONS: Array<{ href: string; icon: string; label: string; sub: string }> = [
  { href: '/m/upload', icon: 'ph-camera', label: '문서 업로드', sub: '등록증·보험·과태료 사진' },
  { href: '/m/scan', icon: 'ph-magnifying-glass', label: '차량 조회', sub: '계약·이력·미납' },
  { href: '/m/todo', icon: 'ph-check-square', label: '내 할 일', sub: '미결업무 요약' },
  { href: '/m/ocr', icon: 'ph-file-text', label: 'OCR 단건 처리', sub: '인식 후 즉시 저장' },
];

export default function MobileTaskSelect() {
  return (
    <div>
      <div className="m-title">업무 선택</div>
      <div className="m-subtitle">현장에서 자주 쓰는 기능 바로가기</div>

      {OPERATIONS.map((op) => (
        <Link key={op.href} href={op.href} className="m-list-item">
          <i className={`ph ${op.icon}`} />
          <div className="m-list-item-body">
            <div className="m-list-item-label">{op.label}</div>
            <div className="m-list-item-sub">{op.sub}</div>
          </div>
          <i className="ph ph-caret-right text-[14px]" />
        </Link>
      ))}

      <div className="text-2xs text-text-muted" style={{ marginTop: 16, textAlign: 'center' }}>
        더 많은 업무가 추후 추가됩니다
      </div>
    </div>
  );
}
