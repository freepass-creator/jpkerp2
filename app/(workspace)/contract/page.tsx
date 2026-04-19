'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Workspace } from '@/components/shared/panel';
import { GridPanel } from '@/components/shared/grid-panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { ContractClient, type ContractRow } from './contract-client';
import { ContractEditDialog } from './contract-edit-dialog';

export default function Page() {
  const gridRef = useRef<JpkGridApi<ContractRow> | null>(null);
  const [count, setCount] = useState(0);
  const [editing, setEditing] = useState<ContractRow | null>(null);

  return (
    <Workspace layout="layout-1">
      <GridPanel<ContractRow>
        icon="ph-handshake"
        title="계약 관리"
        subtitle="행 클릭 → 편집"
        count={count}
        unit="건"
        gridRef={gridRef}
        exportFileName="계약목록"
        primaryActions={
          <Link href="/input?type=contract" className="btn btn-sm btn-primary" style={{ textDecoration: 'none' }}>
            <i className="ph ph-plus" />새 계약
          </Link>
        }
      >
        <ContractClient
          gridRef={gridRef}
          onCountChange={setCount}
          onRowClick={setEditing}
        />
      </GridPanel>
      <ContractEditDialog record={editing} onClose={() => setEditing(null)} />
    </Workspace>
  );
}
