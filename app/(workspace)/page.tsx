import { Panel, Workspace } from '@/components/shared/panel';
import { DashboardClient } from './dashboard-client';

export default function DashboardPage() {
  return (
    <Workspace layout="layout-1">
      <Panel
        icon="ph-squares-four"
        title="대시보드"
        subtitle="실시간 미결업무 · 집계"
      >
        <DashboardClient />
      </Panel>
    </Workspace>
  );
}
