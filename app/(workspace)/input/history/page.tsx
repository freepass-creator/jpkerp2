'use client';

import { useRef, useState } from 'react';
import { Panel, Workspace } from '@/components/shared/panel';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { InputHistoryClient } from './input-history-client';
import { InputHistoryDetail } from './input-history-detail';
import type { UploadRow } from './types';

/**
 * 입력 이력 — 업로드/개별입력 배치 단위 목록 + 세부내용 (2패널).
 * 기존 jpkerp input-history.js 이식.
 */
export default function Page() {
  const gridRef = useRef<JpkGridApi<UploadRow> | null>(null);
  const [selected, setSelected] = useState<UploadRow | null>(null);
  const [count, setCount] = useState(0);

  return (
    <Workspace layout="layout-55">
      <Panel
        icon="ph-clock-counter-clockwise"
        title="업로드 이력"
        subtitle={`${count}건`}
        noPad
      >
        <InputHistoryClient
          gridRef={gridRef}
          onSelect={setSelected}
          selectedId={selected?._id}
          onCountChange={setCount}
        />
      </Panel>
      <Panel
        icon="ph-file-text"
        title="세부내용"
        subtitle={selected ? `${selected.type_label} · ${selected.filename}` : '행 선택'}
        noPad
      >
        <InputHistoryDetail upload={selected} />
      </Panel>
    </Workspace>
  );
}
