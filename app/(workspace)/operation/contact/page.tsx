import { Operation2PanelView } from '../operation-2panel-view';

export default function Page() {
  return (
    <Operation2PanelView
      icon="ph-phone"
      title="고객센터"
      subtitle="응대 이력"
      lockedTypes={['contact']}
    />
  );
}
