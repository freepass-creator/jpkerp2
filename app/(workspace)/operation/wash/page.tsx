import { Operation2PanelView } from '../operation-2panel-view';

export default function Page() {
  return (
    <Operation2PanelView
      icon="ph-drop"
      title="세차"
      subtitle="세차 이력"
      lockedTypes={['wash']}
    />
  );
}
