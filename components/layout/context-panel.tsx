'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextPanelProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  children: React.ReactNode;
}

export function ContextPanel({
  open,
  title,
  subtitle,
  onClose,
  children,
}: ContextPanelProps) {
  if (!open) return null;

  return (
    <aside
      className={cn(
        'w-context-w border-l border-border bg-surface flex flex-col',
        'transition-transform duration-normal ease-default',
      )}
      aria-label="컨텍스트 패널"
    >
      <div className="h-10 border-b border-border flex items-center px-4 gap-3">
        <div className="flex-1 min-w-0">
          {title && (
            <div className="text-sm font-medium truncate">{title}</div>
          )}
          {subtitle && (
            <div className="text-xs text-text-muted truncate">{subtitle}</div>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            aria-label="패널 닫기"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-xs hover:bg-bg-sub text-text-sub"
          >
            <X size={13} strokeWidth={1.75} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">{children}</div>
    </aside>
  );
}
