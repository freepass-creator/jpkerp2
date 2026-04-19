'use client';

import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { IgnitionClient, type IgRow } from './ignition-client';

export default function Page() {
  const gridRef = useRef<JpkGridApi<IgRow> | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-1">
      <GridPanel<IgRow>
        icon="ph-warning-octagon"
        title="시동제어 현황"
        subtitle="조치 진행 계약 + 미납·연체"
        count={count}
        unit="건"
        gridRef={gridRef}
        exportFileName="시동제어현황"
      >
        <IgnitionClient gridRef={gridRef} onCountChange={setCount} />
      </GridPanel>
    </Workspace>
  );
}
