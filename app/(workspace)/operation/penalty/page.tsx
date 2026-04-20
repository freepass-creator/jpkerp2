import { Operation2PanelView } from '../operation-2panel-view';

export default function Page() {
  return (
    <Operation2PanelView
      icon="ph-receipt"
      title="과태료 처리"
      subtitle="과태료·통행료·범칙금 처리 이력"
      lockedTypes={['penalty']}
    />
  );
}
