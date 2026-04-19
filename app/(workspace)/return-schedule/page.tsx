import { Panel, Workspace } from '@/components/shared/panel';
import { ReturnScheduleClient } from './return-schedule-client';

export default function Page() {
  return (
    <Workspace layout="layout-1">
      <Panel icon="ph-arrow-u-down-left" title="반납 일정" subtitle="3개월 이내 만기 계약" noPad>
        <ReturnScheduleClient />
      </Panel>
    </Workspace>
  );
}
