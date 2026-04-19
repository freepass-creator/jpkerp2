'use client';

import { useState } from 'react';
import { Workspace, Panel } from '@/components/shared/panel';
import { OperationHistoryClient } from './operation-history-client';
import { EventDetailPanel } from './event-detail-panel';
import type { RtdbEvent } from '@/lib/types/rtdb-entities';

interface Props {
  icon: string;
  title: string;
  subtitle?: string;
  lockedTypes?: string[];
}

/**
 * 2패널 공통 뷰 — 좌측 이벤트 목록 + 우측 선택 이벤트 상세.
 * 입력이력·전체이력·서브카테고리(contact/delivery/maint/...) 페이지 공용.
 */
export function Operation2PanelView({ icon, title, subtitle, lockedTypes }: Props) {
  const [selected, setSelected] = useState<RtdbEvent | null>(null);

  return (
    <Workspace layout="layout-66">
      <Panel icon={icon} title={title} subtitle={subtitle} noPad>
        <OperationHistoryClient lockedTypes={lockedTypes} onRowClick={setSelected} />
      </Panel>
      <Panel icon="ph-info" title="상세 내역" subtitle={selected ? `${selected.car_number ?? '—'}` : '행 선택'} noPad>
        <EventDetailPanel event={selected} />
      </Panel>
    </Workspace>
  );
}
