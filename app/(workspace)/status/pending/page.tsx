'use client';

import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { PendingClient, type PendingRow } from './pending-client';

export default function Page() {
  const gridRef = useRef<JpkGridApi<PendingRow> | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-1">
      <GridPanel<PendingRow>
        icon="ph-shield-check"
        title="미결업무"
        subtitle="사고진행 · 차량케어 · 미출고 통합"
        count={count}
        unit="건"
        gridRef={gridRef}
        exportFileName="미결업무"
      >
        <PendingClient gridRef={gridRef} onCountChange={setCount} />
      </GridPanel>
    </Workspace>
  );
}
