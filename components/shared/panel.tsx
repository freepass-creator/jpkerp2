/**
 * jpkerp workspace 구조에 맞춘 Panel 컴포넌트.
 *
 * <Workspace> = <section className="workspace layout-1">
 * <Panel>     = <div className="panel"> (panel-head + panel-body)
 *
 * layout-55, layout-37 등 분할 레이아웃은 children으로 <Panel> 2개 이상 배치.
 */

export function Workspace({
  layout = 'layout-1',
  children,
}: {
  layout?: 'layout-1' | 'layout-55' | 'layout-37' | 'layout-66' | 'layout-254' | 'layout-dev';
  children: React.ReactNode;
}) {
  return <section className={`workspace ${layout}`}>{children}</section>;
}

interface PanelProps {
  icon?: string; // phosphor class (e.g. 'ph-car')
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
  noPad?: boolean;
}

export function Panel({
  icon,
  title,
  subtitle,
  actions,
  children,
  bodyClassName,
  noPad,
}: PanelProps) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          {icon && <i className={`ph ${icon}`} />}
          <span className="panel-title">{title}</span>
          {subtitle && <span className="panel-subtitle">{subtitle}</span>}
        </div>
        {actions && <div className="panel-head-actions">{actions}</div>}
      </div>
      <div className={`panel-body ${noPad ? 'no-pad' : ''} ${bodyClassName ?? ''}`}>
        {children}
      </div>
    </div>
  );
}
