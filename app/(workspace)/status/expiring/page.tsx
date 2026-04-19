'use client';

import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { ExpiringClient, type ExpiringRow } from './expiring-client';

export default function Page() {
  const gridRef = useRef<JpkGridApi<ExpiringRow> | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-1">
      <GridPanel<ExpiringRow>
        icon="ph-clock-countdown"
        title="만기도래"
        subtitle="지정 기간 내 종료 예정 계약"
        count={count}
        unit="건"
        gridRef={gridRef}
        exportFileName="만기도래"
      >
        <ExpiringClient gridRef={gridRef} onCountChange={setCount} />
      </GridPanel>
    </Workspace>
  );
}
