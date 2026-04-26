'use client';

import { Panel, Workspace } from '@/components/shared/panel';
import { AutoDebitClient } from './autodebit-client';

export default function Page() {
  return (
    <Workspace layout="layout-1">
      <Panel icon="ph-arrows-clockwise" title="자동이체" subtitle="CMS 자동이체 등록 현황" noPad>
        <AutoDebitClient />
      </Panel>
    </Workspace>
  );
}
