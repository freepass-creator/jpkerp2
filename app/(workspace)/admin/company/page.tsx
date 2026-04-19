import { Panel, Workspace } from '@/components/shared/panel';
import { CompanyClient } from './company-client';

export default function Page() {
  return (
    <Workspace layout="layout-1">
      <Panel icon="ph-info" title="회사 정보" subtitle="법인 기본 정보 · 필드 클릭 → 자동 저장">
        <CompanyClient />
      </Panel>
    </Workspace>
  );
}
