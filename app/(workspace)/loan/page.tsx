'use client';

import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { LoanClient, type RtdbLoan } from './loan-client';

export default function Page() {
  const gridRef = useRef<JpkGridApi<RtdbLoan> | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-1">
      <GridPanel<RtdbLoan>
        icon="ph-bank"
        title="할부 관리"
        subtitle="차량별 할부 현황"
        count={count}
        unit="건"
        gridRef={gridRef}
        exportFileName="할부내역"
      >
        <LoanClient gridRef={gridRef} onCountChange={setCount} />
      </GridPanel>
    </Workspace>
  );
}
