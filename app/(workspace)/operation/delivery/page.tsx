import { Operation2PanelView } from '../operation-2panel-view';

export default function Page() {
  return (
    <Operation2PanelView
      icon="ph-truck"
      title="입출고센터"
      subtitle="출고·반납·이동·강제회수"
      lockedTypes={['delivery', 'return', 'force', 'transfer']}
    />
  );
}
