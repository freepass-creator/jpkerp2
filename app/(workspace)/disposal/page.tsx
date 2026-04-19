'use client';

import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { DisposalClient, type DisposalRow } from './disposal-client';

export default function Page() {
  const gridRef = useRef<JpkGridApi<DisposalRow> | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-1">
      <GridPanel<DisposalRow>
        icon="ph-currency-circle-dollar"
        title="매각 차량"
        subtitle="매각·대기 + 손익 집계"
        count={count}
        unit="대"
        gridRef={gridRef}
        exportFileName="매각차량"
      >
        <DisposalClient gridRef={gridRef} onCountChange={setCount} />
      </GridPanel>
    </Workspace>
  );
}
