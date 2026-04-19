import { Panel, Workspace } from '@/components/shared/panel';
import { FundClient } from './fund-client';

export default function Page() {
  return (
    <Workspace layout="layout-1">
      <Panel icon="ph-bank" title="자금 관리" subtitle="통장·카드 CSV 업로드 · 입출금 자동 등록" noPad>
        <FundClient />
      </Panel>
    </Workspace>
  );
}
