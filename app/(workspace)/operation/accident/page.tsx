import { Operation2PanelView } from '../operation-2panel-view';

export default function Page() {
  return (
    <Operation2PanelView
      icon="ph-car-profile"
      title="사고 이력"
      subtitle="사고 발생·처리"
      lockedTypes={['accident']}
    />
  );
}
