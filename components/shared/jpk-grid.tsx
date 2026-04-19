'use client';

import { useEffect, useMemo, useRef, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridOptions,
  type GridApi,
  type GridReadyEvent,
  type FilterChangedEvent,
} from 'ag-grid-community';
import '@/lib/grid/set-filter-styles';
import { GridContextMenu, type ContextMenuItem } from './grid-context-menu';
import { JpkHeader } from './grid-header';

let _registered = false;
function ensureModules() {
  if (_registered) return;
  ModuleRegistry.registerModules([AllCommunityModule]);
  _registered = true;
}

export interface JpkGridApi<T = unknown> {
  exportCsv: (fileName?: string) => void;
  resetFilters: () => void;
  autoSizeAllColumns: () => void;
  getFilteredRowCount: () => number;
  getSelectedRow: () => T | null;
}

interface JpkGridProps<T> {
  columnDefs: ColDef<T>[];
  rowData: T[];
  getRowId?: (data: T) => string;
  onRowClicked?: (row: T) => void;
  onGridReady?: (e: GridReadyEvent<T>) => void;
  height?: string | number;
  className?: string;
  storageKey?: string;
  rowSelection?: boolean;
  options?: Partial<GridOptions<T>>;
  /** 행 우클릭 컨텍스트 메뉴 항목 빌더 */
  contextMenu?: (row: T) => ContextMenuItem[];
}

function JpkGridInner<T>(
  {
    columnDefs,
    rowData,
    getRowId,
    onRowClicked,
    onGridReady,
    height = '100%',
    className,
    storageKey,
    rowSelection = true,
    options,
    contextMenu,
  }: JpkGridProps<T>,
  ref: React.Ref<JpkGridApi<T>>,
) {
  ensureModules();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<GridApi<T> | null>(null);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  // 컬럼별 정렬 (엑셀식 우클릭 지정) — localStorage 영속
  type Align = 'left' | 'right' | 'center';
  const alignKey = storageKey ? `${storageKey}.align` : null;
  const [alignments, setAlignments] = useState<Record<string, Align>>({});
  useEffect(() => {
    if (!alignKey) return;
    try {
      const raw = localStorage.getItem(alignKey);
      if (raw) setAlignments(JSON.parse(raw));
    } catch {}
  }, [alignKey]);
  const setAlign = useCallback((colId: string, a: Align | undefined) => {
    setAlignments((cur) => {
      const next = { ...cur };
      if (!a || a === 'left') delete next[colId];
      else next[colId] = a;
      if (alignKey) {
        try { localStorage.setItem(alignKey, JSON.stringify(next)); } catch {}
      }
      return next;
    });
  }, [alignKey]);
  // 고유 컨테이너 식별자 — CSS scope용
  const gridId = useMemo(() => `jg_${Math.random().toString(36).slice(2, 8)}`, []);
  const alignCss = useMemo(() => {
    const rules: string[] = [];
    for (const [colId, a] of Object.entries(alignments)) {
      const sel = `#${gridId} .ag-cell[col-id="${colId}"]`;
      const hdr = `#${gridId} .ag-header-cell[col-id="${colId}"] .ag-header-cell-label`;
      if (a === 'right') {
        rules.push(`${sel}{text-align:right;justify-content:flex-end}`);
        rules.push(`${hdr}{justify-content:flex-end}`);
      } else if (a === 'center') {
        rules.push(`${sel}{text-align:center;justify-content:center}`);
        rules.push(`${hdr}{justify-content:center}`);
      }
    }
    return rules.join('');
  }, [alignments, gridId]);

  const defaultColDef: ColDef = useMemo(
    () => ({
      resizable: true,
      sortable: true,
      filter: 'agTextColumnFilter',
      minWidth: 44,
      headerComponent: JpkHeader,
      suppressHeaderMenuButton: true, // 헤더 우측 필터 아이콘 숨김 (헤더 클릭으로 직접 열림)
    }),
    [],
  );

  const savedWidths = useMemo<Record<string, number>>(() => {
    if (!storageKey || typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return {};
      const arr = JSON.parse(raw) as Array<{ colId: string; width?: number }>;
      const m: Record<string, number> = {};
      for (const s of arr) if (s.width) m[s.colId] = s.width;
      return m;
    } catch {
      return {};
    }
  }, [storageKey]);

  const cols = useMemo<ColDef<T>[]>(
    () =>
      columnDefs.map((c) => {
        const w = c.field ? savedWidths[c.field] : undefined;
        return w ? { ...c, width: w } : c;
      }),
    [columnDefs, savedWidths],
  );

  const saveState = useCallback(
    (api: GridApi<T>) => {
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(api.getColumnState()));
      } catch {}
    },
    [storageKey],
  );

  const updateFilterBadges = useCallback(() => {
    const api = apiRef.current;
    const container = containerRef.current;
    if (!api || !container) return;
    const models = api.getFilterModel() as Record<string, { count?: number; values?: string[] } | undefined>;
    for (const col of api.getColumnState()) {
      const cell = container.querySelector(`.ag-header-cell[col-id="${col.colId}"]`);
      if (!cell) continue;
      const m = models[col.colId];
      const count = m?.count ?? (m?.values ? m.values.length : 0);
      if (m && count > 0) cell.setAttribute('data-filter-count', String(count));
      else cell.removeAttribute('data-filter-count');
    }
  }, []);

  const onFilterChanged = useCallback(
    (e: FilterChangedEvent<T>) => {
      updateFilterBadges();
      saveState(e.api);
    },
    [updateFilterBadges, saveState],
  );

  // Imperative API
  useImperativeHandle(
    ref,
    () => ({
      exportCsv: (fileName) => {
        apiRef.current?.exportDataAsCsv({ fileName: fileName ? `${fileName}.csv` : undefined });
      },
      resetFilters: () => {
        apiRef.current?.setFilterModel(null);
        apiRef.current?.applyColumnState({ defaultState: { sort: null } });
      },
      autoSizeAllColumns: () => {
        const api = apiRef.current;
        if (!api) return;
        const allCols = api.getColumns()?.map((c) => c.getColId()).filter(Boolean) ?? [];
        if (allCols.length) {
          api.autoSizeColumns(allCols, true); // skipHeader=true: 콘텐츠 기준으로만 타이트하게
          api.sizeColumnsToFit();               // 남은 가로 공간 비례 분배
        }
      },
      getFilteredRowCount: () => apiRef.current?.getDisplayedRowCount() ?? 0,
      getSelectedRow: () => (apiRef.current?.getSelectedRows()?.[0] as T) ?? null,
    }),
    [],
  );

  return (
    <div
      ref={containerRef}
      id={gridId}
      className={`ag-theme-alpine ${className ?? ''}`}
      style={{ width: '100%', height }}
      onContextMenu={(e) => {
        if (!apiRef.current) return;
        const target = e.target as HTMLElement;
        const rowEl = target.closest('.ag-row') as HTMLElement | null;
        const cellEl = target.closest('.ag-cell') as HTMLElement | null;
        const colId = cellEl?.getAttribute('col-id') ?? '';
        if (!rowEl) return;
        e.preventDefault();
        const rowIndex = Number(rowEl.getAttribute('row-index'));
        const node = apiRef.current.getDisplayedRowAtIndex(rowIndex);
        if (!node?.data) return;
        const userItems = contextMenu ? contextMenu(node.data) : [];
        // 엑셀식 정렬 메뉴
        const alignItems: ContextMenuItem[] = colId
          ? [
              { divider: true, label: '' },
              { label: '좌측 정렬', icon: 'ph-text-align-left', onClick: () => setAlign(colId, 'left') },
              { label: '가운데 정렬', icon: 'ph-text-align-center', onClick: () => setAlign(colId, 'center') },
              { label: '우측 정렬', icon: 'ph-text-align-right', onClick: () => setAlign(colId, 'right') },
            ]
          : [];
        const items = [...userItems, ...alignItems];
        if (items.length === 0) return;
        setCtxMenu({ x: e.clientX, y: e.clientY, items });
      }}
    >
      {alignCss && <style>{alignCss}</style>}
      <AgGridReact<T>
        theme="legacy"
        columnDefs={cols}
        rowData={rowData}
        defaultColDef={defaultColDef}
        rowHeight={28}
        headerHeight={28}
        animateRows={false}
        suppressContextMenu
        singleClickEdit
        stopEditingWhenCellsLoseFocus
        autoSizePadding={6}
        autoSizeStrategy={{ type: 'fitGridWidth', defaultMinWidth: 60 }}
        rowSelection={rowSelection ? 'single' : undefined}
        getRowId={getRowId ? (p) => getRowId(p.data) : undefined}
        onRowClicked={(e) => e.data && onRowClicked?.(e.data)}
        onGridReady={(e) => {
          apiRef.current = e.api;
          onGridReady?.(e);
          if (storageKey) {
            try {
              const raw = localStorage.getItem(storageKey);
              if (raw) e.api.applyColumnState({ state: JSON.parse(raw), applyOrder: true });
            } catch {}
          }
          setTimeout(() => updateFilterBadges(), 100);
        }}
        onColumnResized={(e) => saveState(e.api)}
        onColumnMoved={(e) => saveState(e.api)}
        onSortChanged={(e) => saveState(e.api)}
        onFilterChanged={onFilterChanged}
        {...options}
      />
      {ctxMenu && (
        <GridContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

// forwardRef with generics
export const JpkGrid = forwardRef(JpkGridInner) as <T>(
  props: JpkGridProps<T> & { ref?: React.Ref<JpkGridApi<T>> },
) => React.ReactElement;
