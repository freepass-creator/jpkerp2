import { Operation2PanelView } from '../operation-2panel-view';

export default function Page() {
  return (
    <Operation2PanelView
      icon="ph-wrench"
      title="정비 이력"
      subtitle="정비·수리"
      lockedTypes={['maint', 'maintenance', 'repair']}
    />
  );
}
