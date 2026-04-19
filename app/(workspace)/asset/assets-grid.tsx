'use client';

import { useEffect, useMemo, useRef, type Ref, type RefObject } from 'react';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { JpkGrid, type JpkGridApi } from '@/components/shared/jpk-grid';
import { JpkSetFilter } from '@/lib/grid/set-filter';
import type { ColDef } from 'ag-grid-community';

type Asset = {
  _key?: string;
  car_number?: string;
  vin?: string;
  partner_code?: string;
  manufacturer?: string;
  car_model?: string;
  detail_model?: string;
  car_year?: number | string;
  fuel_type?: string;
  ext_color?: string;
  current_mileage?: number | string;
  last_maint_date?: string;
  status?: string;
  [k: string]: unknown;
};

type Contract = {
  _key?: string;
  car_number?: string;
  contractor_name?: string;
  contract_status?: string;
  end_date?: string;
  status?: string;
  [k: string]: unknown;
};

interface AssetsGridProps {
  gridRef?: RefObject<JpkGridApi<Asset> | null>;
  onCountChange?: (count: number) => void;
}

export function AssetsGrid({ gridRef: externalRef, onCountChange }: AssetsGridProps = {}) {
  const internalRef = useRef<JpkGridApi<Asset> | null>(null);
  const gridRef = externalRef ?? internalRef;
  const assets = useRtdbCollection<Asset>('assets');
  const contracts = useRtdbCollection<Contract>('contracts');

  // 계약 정보 JOIN (car_number 기반)
  const rows = useMemo(() => {
    const active = new Map<string, Contract>();
    for (const c of contracts.data) {
      if (c.status === 'deleted') continue;
      if (c.contract_status !== '계약진행') continue;
      if (c.car_number) active.set(c.car_number, c);
    }
    return assets.data.map((a) => {
      const c = a.car_number ? active.get(a.car_number) : undefined;
      return {
        ...a,
        _contractor: c?.contractor_name ?? '',
        _contract_status: c?.contract_status ?? '',
      };
    });
  }, [assets.data, contracts.data]);

  useEffect(() => { onCountChange?.(rows.length); }, [rows.length, onCountChange]);

  const columnDefs = useMemo<ColDef<Asset>[]>(
    () =>
      [
        {
          headerName: '#',
          valueGetter: (p: { node: { rowIndex: number | null } | null }) =>
            (p.node?.rowIndex ?? 0) + 1,
          width: 50,
          filter: false,
          sortable: false,
          cellStyle: { color: 'var(--c-text-muted)' },
        },
        { headerName: '회사코드', field: 'partner_code', width: 85, filter: JpkSetFilter },
        {
          headerName: '차량번호',
          field: 'car_number',
          width: 100,
          cellStyle: { fontWeight: '600' },
        },
        { headerName: '제조사', field: 'manufacturer', width: 90, filter: JpkSetFilter },
        { headerName: '모델', field: 'car_model', width: 130 },
        { headerName: '세부모델', field: 'detail_model', flex: 1, minWidth: 160 },
        {
          headerName: '연식',
          field: 'car_year',
          width: 70,
          filter: false,
          cellStyle: { textAlign: 'right' },
        },
        { headerName: '연료', field: 'fuel_type', width: 75, filter: JpkSetFilter },
        { headerName: '외장색', field: 'ext_color', width: 80, filter: JpkSetFilter },
        { headerName: '계약자', field: '_contractor', width: 100 },
        {
          headerName: '상태',
          field: '_contract_status',
          width: 85,
          filter: JpkSetFilter,
          cellStyle: (p: { value: unknown }) => ({
            color: p.value === '계약진행' ? 'var(--c-success)' : 'var(--c-text-muted)',
            fontWeight: '500',
          }),
        },
        {
          headerName: '주행거리',
          field: 'current_mileage',
          width: 100,
          filter: false,
          cellStyle: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
          valueFormatter: (p: { value: unknown }) => {
            const n = Number(p.value);
            return Number.isFinite(n) && n > 0 ? n.toLocaleString('ko-KR') : '-';
          },
        },
        { headerName: '최종정비', field: 'last_maint_date', width: 100, filter: false },
      ] as ColDef<Asset>[],
    [],
  );

  if (assets.loading) {
    return (
      <div className="h-full flex items-center justify-center gap-2 text-text-muted">
        <i className="ph ph-spinner" style={{ animation: 'spin 1s linear infinite' }} />
        <span>차량 데이터 로드 중...</span>
      </div>
    );
  }

  if (assets.error) {
    return (
      <div className="p-6">
        <div className="panel p-4">
          <div className="font-bold text-danger mb-1">데이터 로드 실패</div>
          <div className="text-text-sub">{assets.error.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%' }}>
      <JpkGrid<Asset>
        ref={gridRef as Ref<JpkGridApi<Asset>>}
        columnDefs={columnDefs}
        rowData={rows}
        getRowId={(d) => d._key ?? d.car_number ?? ''}
        storageKey="jpk.grid.assets"
        contextMenu={() => [
          { label: 'CSV 내보내기', icon: 'ph-download-simple', onClick: () => gridRef.current?.exportCsv('자산목록') },
          { label: '필터 초기화', icon: 'ph-funnel-x', onClick: () => gridRef.current?.resetFilters() },
        ]}
      />
    </div>
  );
}
