'use client';

import type { IHeaderParams } from 'ag-grid-community';
import { useEffect, useState, useCallback, useRef } from 'react';

export function JpkHeader(props: IHeaderParams) {
  const [sort, setSort] = useState<'asc' | 'desc' | null>(null);
  const [filtered, setFiltered] = useState(false);
  const justClosed = useRef(false);

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

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (props.column.getColDef().filter === false) {
      props.progressSort(e.shiftKey);
      return;
    }
    // AG Grid가 클릭 시 기존 팝업을 먼저 닫음 → 직후 showColumnMenu 호출하면 다시 열림
    // justClosed 플래그로 방금 닫힌 직후엔 열지 않음
    if (justClosed.current) {
      justClosed.current = false;
      return;
    }
    props.showColumnMenu(e.currentTarget as HTMLElement);
  }, [props]);

  // 팝업 닫힘 감지 — mousedown 시점에 팝업이 있었으면 닫히는 거니까 스킵
  const handleMouseDown = useCallback(() => {
    const popup = document.querySelector('.ag-popup');
    if (popup) {
      justClosed.current = true;
      // 다음 틱에서 리셋 (클릭 이벤트 이후)
      setTimeout(() => { justClosed.current = false; }, 300);
    }
  }, []);

  return (
    <button
      type="button"
      className="jpk-header"
      onMouseDown={handleMouseDown}
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
