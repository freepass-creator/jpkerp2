'use client';

import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import type { RtdbEvent } from '@/lib/types/rtdb-entities';
import { LedgerClient } from './ledger-client';

export default function Page() {
  const gridRef = useRef<JpkGridApi<RtdbEvent> | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-1">
      <GridPanel<RtdbEvent>
        icon="ph-wallet"
        title="입출금 내역"
        subtitle="통장·카드 거래 전체"
        count={count}
        unit="건"
        gridRef={gridRef}
        exportFileName="입출금"
      >
        <LedgerClient gridRef={gridRef} onCountChange={setCount} />
      </GridPanel>
    </Workspace>
  );
}
