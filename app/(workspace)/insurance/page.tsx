'use client';

import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { InsuranceClient, type RtdbInsurance } from './insurance-client';

export default function Page() {
  const gridRef = useRef<JpkGridApi<RtdbInsurance> | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-1">
      <GridPanel<RtdbInsurance>
        icon="ph-shield-check"
        title="보험 관리"
        subtitle="차량별 보험 증권·만기"
        count={count}
        unit="건"
        gridRef={gridRef}
        exportFileName="보험목록"
      >
        <InsuranceClient gridRef={gridRef} onCountChange={setCount} />
      </GridPanel>
    </Workspace>
  );
}
