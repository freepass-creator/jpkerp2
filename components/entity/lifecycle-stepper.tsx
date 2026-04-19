import { cn } from '@/lib/utils';

type Stage =
  | 'acquired'
  | 'marketing'
  | 'contracted'
  | 'delivered'
  | 'operating'
  | 'expiring'
  | 'returned'
  | 'disposed'
  | 'renewed';

const ORDER: { key: Stage; label: string }[] = [
  { key: 'acquired', label: '취득' },
  { key: 'marketing', label: '영업' },
  { key: 'contracted', label: '계약' },
  { key: 'delivered', label: '출고' },
  { key: 'operating', label: '운영' },
  { key: 'expiring', label: '만기' },
  { key: 'returned', label: '반납' },
];

interface Props {
  current: Stage;
  terminal?: 'disposed' | 'renewed' | null;
}

export function LifecycleStepper({ current, terminal }: Props) {
  const currentIdx = ORDER.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-1 py-2 px-4">
      {ORDER.map((stage, i) => {
        const reached = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={stage.key} className="flex items-center">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                reached ? 'bg-primary' : 'bg-border',
                isCurrent && 'ring-2 ring-primary-border',
              )}
            />
            <span
              className={cn(
                'ml-1 text-xs',
                isCurrent
                  ? 'text-primary font-medium'
                  : reached
                    ? 'text-text-sub'
                    : 'text-text-muted',
              )}
            >
              {stage.label}
            </span>
            {i < ORDER.length - 1 && (
              <div
                className={cn(
                  'w-6 h-px mx-1.5',
                  i < currentIdx ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </div>
        );
      })}
      {terminal && (
        <>
          <div className="w-6 h-px mx-1.5 bg-border" />
          <div
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-xs',
              terminal === 'disposed'
                ? 'bg-danger-bg text-danger'
                : 'bg-success-bg text-success',
            )}
          >
            {terminal === 'disposed' ? '매각' : '연장'}
          </div>
        </>
      )}
    </div>
  );
}
