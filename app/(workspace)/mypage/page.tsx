import { Panel, Workspace } from '@/components/shared/panel';
import { MyClient } from './my-client';

export default function Page() {
  return (
    <Workspace layout="layout-1">
      <Panel icon="ph-user-circle" title="내 정보" subtitle="프로필 · 근무정보 · 권한">
        <MyClient />
      </Panel>
    </Workspace>
  );
}
