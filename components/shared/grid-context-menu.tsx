'use client';

import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: string; // phosphor class
  onClick?: () => void;
  divider?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function GridContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    // 다음 틱에 바인딩 (현재 우클릭 이벤트 전파 막기)
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onClick);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // 화면 경계 보정
  const maxX = typeof window !== 'undefined' ? window.innerWidth - 200 : x;
  const maxY = typeof window !== 'undefined' ? window.innerHeight - items.length * 32 - 16 : y;

  return (
    <div
      ref={ref}
      className="jpk-ctx-menu"
      style={{
        left: Math.min(x, maxX),
        top: Math.min(y, maxY),
      }}
      role="menu"
    >
      {items.map((it, i) =>
        it.divider ? (
          <div key={`d-${i}`} className="jpk-ctx-divider" />
        ) : (
          <button
            key={it.label}
            type="button"
            className={`jpk-ctx-item ${it.danger ? 'is-danger' : ''}`}
            onClick={() => {
              if (!it.disabled) {
                it.onClick?.();
                onClose();
              }
            }}
            disabled={it.disabled}
          >
            {it.icon && <i className={`ph ${it.icon}`} />}
            <span>{it.label}</span>
          </button>
        ),
      )}
    </div>
  );
}
