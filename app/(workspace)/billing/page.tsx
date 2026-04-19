'use client';

import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { BillingClient, type BillRow } from './billing-client';

export default function Page() {
  const gridRef = useRef<JpkGridApi<BillRow> | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-1">
      <GridPanel<BillRow>
        icon="ph-currency-krw"
        title="수납 관리"
        subtitle="회차별 청구·입금·연체 현황"
        count={count}
        unit="건"
        gridRef={gridRef}
        exportFileName="수납내역"
      >
        <BillingClient gridRef={gridRef} onCountChange={setCount} />
      </GridPanel>
    </Workspace>
  );
}
