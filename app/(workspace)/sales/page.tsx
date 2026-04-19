'use client';

import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { SalesClient, type SalesRow } from './sales-client';

export default function Page() {
  const gridRef = useRef<JpkGridApi<SalesRow> | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-1">
      <GridPanel<SalesRow>
        icon="ph-chart-line-up"
        title="실적 관리"
        subtitle="월별 신규 계약·매출"
        count={count}
        unit="개월"
        gridRef={gridRef}
        exportFileName="실적"
      >
        <SalesClient gridRef={gridRef} onCountChange={setCount} />
      </GridPanel>
    </Workspace>
  );
}
