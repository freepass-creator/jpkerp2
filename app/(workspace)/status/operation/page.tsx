'use client';

import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { OperationReportClient, type OpRow } from './operation-client';

export default function Page() {
  const gridRef = useRef<JpkGridApi<OpRow> | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-1">
      <GridPanel<OpRow>
        icon="ph-chart-line"
        title="통합 리포트"
        subtitle="차량별 손익·계약·수납·할부·보험·운영 종합"
        count={count}
        unit="대"
        gridRef={gridRef}
        exportFileName="통합리포트"
      >
        <OperationReportClient gridRef={gridRef} onCountChange={setCount} />
      </GridPanel>
    </Workspace>
  );
}
