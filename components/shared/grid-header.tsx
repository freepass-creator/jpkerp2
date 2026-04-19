'use client';

import type { IHeaderParams } from 'ag-grid-community';
import { useEffect, useState } from 'react';

/**
 * 엑셀식 헤더 — 클릭하면 필터 드롭다운 열림, 별도 필터 아이콘 없음.
 * 정렬은 필터 드롭다운 안의 오름/내림 버튼으로 처리.
 */
export function JpkHeader(props: IHeaderParams) {
  const [sort, setSort] = useState<'asc' | 'desc' | null>(null);
  const [filtered, setFiltered] = useState(false);

  useEffect(() => {
    const col = props.column;
    const onSort = () => setSort((col.getSort() as 'asc' | 'desc' | null) ?? null);
    const onFilter = () => setFiltered(col.isFilterActive());
    onSort(); onFilter();
    col.addEventListener('sortChanged', onSort);
    col.addEventListener('filterChanged', onFilter);
    return () => {
      col.removeEventListener('sortChanged', onSort);
      col.removeEventListener('filterChanged', onFilter);
    };
  }, [props.column]);

  const handleClick = (e: React.MouseEvent) => {
    if (props.column.getColDef().filter === false) {
      // 필터 없는 컬럼 (숫자 등) — 헤더 클릭 = 정렬 토글
      props.progressSort(e.shiftKey);
      return;
    }
    // 필터 있는 컬럼 — 필터 드롭다운 열기
    props.showColumnMenu(e.currentTarget as HTMLElement);
  };

  return (
    <button
      type="button"
      className="jpk-header"
      onClick={handleClick}
      data-sorted={sort ?? undefined}
      data-filtered={filtered || undefined}
    >
      <span className="jpk-header-label">{props.displayName}</span>
      {sort === 'asc' && <i className="ph ph-caret-up jpk-header-sort" />}
      {sort === 'desc' && <i className="ph ph-caret-down jpk-header-sort" />}
    </button>
  );
}
