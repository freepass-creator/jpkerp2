'use client';

import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { ProductClient, type ProductRow } from './product-client';

export default function Page() {
  const gridRef = useRef<JpkGridApi<ProductRow> | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-1">
      <GridPanel<ProductRow>
        icon="ph-storefront"
        title="상품대기"
        subtitle="계약 없는 출고 가능 자산"
        count={count}
        unit="대"
        gridRef={gridRef}
        exportFileName="상품대기"
      >
        <ProductClient gridRef={gridRef} onCountChange={setCount} />
      </GridPanel>
    </Workspace>
  );
}
