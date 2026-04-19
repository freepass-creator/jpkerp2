'use client';

import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { FinanceClient, type MonthlyRow } from './finance-client';

export default function Page() {
  const gridRef = useRef<JpkGridApi<MonthlyRow> | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-1">
      <GridPanel<MonthlyRow>
        icon="ph-chart-bar"
        title="재무 보고"
        subtitle="월별 매출·지출·순익"
        count={count}
        unit="개월"
        gridRef={gridRef}
        exportFileName="재무보고"
      >
        <FinanceClient gridRef={gridRef} onCountChange={setCount} />
      </GridPanel>
    </Workspace>
  );
}
