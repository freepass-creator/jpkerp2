'use client';

import type { RefObject } from 'react';
import type { JpkGridApi } from './jpk-grid';
import { toast } from 'sonner';

interface Props<T = unknown> {
  gridRef: RefObject<JpkGridApi<T> | null>;
  /** CSV 파일 이름 (확장자 제외) */
  exportFileName?: string;
  extraActions?: React.ReactNode;
}

/**
 * 패널헤더 우측에 붙이는 그리드 공용 액션.
 * - 내보내기 (CSV)
 * - 필터 초기화
 * - 컬럼 자동조정
 */
export function GridToolbar<T = unknown>({ gridRef, exportFileName, extraActions }: Props<T>) {
  const api = gridRef.current;
  return (
    <>
      {extraActions}
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={() => {
          if (!gridRef.current) return;
          gridRef.current.exportCsv(exportFileName);
          toast.success('CSV 내보내기 완료');
        }}
        aria-label="CSV 내보내기"
        title="CSV 내보내기"
      >
        <i className="ph ph-download-simple" />
        내보내기
      </button>
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={() => {
          gridRef.current?.resetFilters();
          toast.success('필터 초기화');
        }}
        aria-label="필터 초기화"
        title="필터 초기화"
      >
        <i className="ph ph-funnel-x" />
        필터 초기화
      </button>
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={() => gridRef.current?.autoSizeAllColumns()}
        aria-label="컬럼 자동 조정"
        title="컬럼 자동 조정"
      >
        <i className="ph ph-arrows-out-line-horizontal" />
      </button>
    </>
  );
}
