'use client';

import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { IdleClient, type IdleRow } from './idle-client';

export default function Page() {
  const gridRef = useRef<JpkGridApi<IdleRow> | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-1">
      <GridPanel<IdleRow>
        icon="ph-pause-circle"
        title="휴차 현황"
        subtitle="계약 없는 자산 + 사유별 집계"
        count={count}
        unit="대"
        gridRef={gridRef}
        exportFileName="휴차현황"
      >
        <IdleClient gridRef={gridRef} onCountChange={setCount} />
      </GridPanel>
    </Workspace>
  );
}
