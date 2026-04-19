'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { AssetsGrid } from './assets-grid';

type Asset = { _key?: string; car_number?: string; [k: string]: unknown };

export default function AssetPage() {
  const gridRef = useRef<JpkGridApi<Asset> | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-1">
      <GridPanel<Asset>
        icon="ph-car"
        title="자산 목록"
        subtitle="행 클릭 시 차량 프로필"
        count={count}
        unit="대"
        gridRef={gridRef}
        exportFileName="자산목록"
        primaryActions={
          <Link
            href="/input?type=asset"
            className="btn btn-sm btn-primary"
            style={{ textDecoration: 'none' }}
          >
            <i className="ph ph-plus" />새 차량
          </Link>
        }
      >
        <AssetsGrid gridRef={gridRef} onCountChange={setCount} />
      </GridPanel>
    </Workspace>
  );
}
