'use client';

import { useRef, useState, useEffect, type Ref } from 'react';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { JpkGrid, type JpkGridApi } from './jpk-grid';
import { GridPanel } from './grid-panel';
import type { ColDef } from 'ag-grid-community';

interface Props<T> {
  /** RTDB 경로 (예: 'partners', 'vendors') */
  path: string;
  columnDefs: ColDef<T>[];
  storageKey: string;
  getRowId?: (data: T) => string;
  emptyMessage?: string;
  exportFileName?: string;
  /** 행 클릭 시 호출 (편집 모달 오픈 등) */
  onRowClick?: (row: T) => void;

  /** GridPanel 래핑 옵션 — 생략 시 순수 grid만 렌더 */
  title?: string;
  subtitle?: string;
  icon?: string;
  unit?: string;
  primaryActions?: React.ReactNode;
}

/**
 * RTDB 경로 → AG Grid + (선택) GridPanel 래핑.
 * 규격 통일: `title` prop 주면 자동으로 GridPanel + count + toolbar 붙음.
 */
export function SimpleRtdbGrid<T extends Record<string, unknown>>({
  path,
  columnDefs,
  storageKey,
  getRowId,
  emptyMessage = '데이터가 없습니다',
  exportFileName,
  onRowClick,
  title,
  subtitle,
  icon,
  unit = '건',
  primaryActions,
}: Props<T>) {
  const { data, loading, error } = useRtdbCollection<T>(path);
  const gridRef = useRef<JpkGridApi<T> | null>(null);
  const [count, setCount] = useState(0);
  useEffect(() => { setCount(data.length); }, [data.length]);

  const grid = (() => {
    if (loading) {
      return (
        <div className="flex items-center justify-center gap-2 text-text-muted" style={{ height: '100%', minHeight: 200 }}>
          <i className="ph ph-spinner spin" /> 로드 중...
        </div>
      );
    }
    if (error) {
      return (
        <div style={{ padding: 16 }}>
          <div className="panel p-4">
            <div className="font-bold text-danger">데이터 로드 실패</div>
            <div className="text-text-sub">{error.message}</div>
          </div>
        </div>
      );
    }
    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center gap-2 text-text-muted" style={{ height: '100%', minHeight: 200 }}>
          <i className="ph ph-inbox" style={{ fontSize: 24 }} />
          <span>{emptyMessage}</span>
        </div>
      );
    }
    return (
      <JpkGrid<T>
        ref={gridRef as Ref<JpkGridApi<T>>}
        columnDefs={columnDefs}
        rowData={data}
        getRowId={getRowId}
        storageKey={storageKey}
        onRowClicked={onRowClick}
        contextMenu={() => [
          { label: 'CSV 내보내기', icon: 'ph-download-simple', onClick: () => gridRef.current?.exportCsv(exportFileName ?? storageKey.replace(/^jpk\.grid\./, '')) },
          { label: '필터 초기화', icon: 'ph-funnel-x', onClick: () => gridRef.current?.resetFilters() },
          { label: '컬럼 자동조정', icon: 'ph-arrows-out-line-horizontal', onClick: () => gridRef.current?.autoSizeAllColumns() },
        ]}
      />
    );
  })();

  // title 주면 GridPanel 래핑, 없으면 grid만 반환 (기존 호환)
  if (!title) return grid;

  return (
    <GridPanel<T>
      icon={icon}
      title={title}
      subtitle={subtitle}
      count={count}
      unit={unit}
      gridRef={gridRef}
      exportFileName={exportFileName ?? storageKey.replace(/^jpk\.grid\./, '')}
      primaryActions={primaryActions}
    >
      {grid}
    </GridPanel>
  );
}
