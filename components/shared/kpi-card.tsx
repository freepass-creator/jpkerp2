import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  tone?: 'default' | 'success' | 'warn' | 'danger' | 'primary';
  className?: string;
}

const TONE_CLASS: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'text-text',
  primary: 'text-primary',
  success: 'text-success',
  warn: 'text-warn',
  danger: 'text-danger',
};

export function KpiCard({
  label,
  value,
  sub,
  trend,
  trendValue,
  tone = 'default',
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'panel px-4 py-3 flex flex-col gap-1',
        className,
      )}
    >
      <div className="text-xs text-text-muted">{label}</div>
      <div className={cn('text-base font-bold num', TONE_CLASS[tone])}>
        {value}
      </div>
      {(sub || trendValue) && (
        <div className="text-xs text-text-sub flex items-center gap-2">
          {trendValue && (
            <span
              className={cn(
                trend === 'up' && 'text-success',
                trend === 'down' && 'text-danger',
              )}
            >
              {trend === 'up' && '▲ '}
              {trend === 'down' && '▼ '}
              {trend === 'flat' && '– '}
              {trendValue}
            </span>
          )}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  );
}
