interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="panel-head">
      <div className="flex-1 min-w-0">
        <div className="panel-head-title">{title}</div>
        {subtitle && <div className="panel-head-sub">{subtitle}</div>}
      </div>
      {actions}
    </div>
  );
}
