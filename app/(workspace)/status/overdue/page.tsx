'use client';

import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { OverdueClient, type OverdueRow } from './overdue-client';

export default function Page() {
  const gridRef = useRef<JpkGridApi<OverdueRow> | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-1">
      <GridPanel<OverdueRow>
        icon="ph-warning-circle"
        title="미납 현황"
        subtitle="계약자별 미납 총액·연체일·조치이력"
        count={count}
        unit="건"
        gridRef={gridRef}
        exportFileName="미납현황"
      >
        <OverdueClient gridRef={gridRef} onCountChange={setCount} />
      </GridPanel>
    </Workspace>
  );
}
