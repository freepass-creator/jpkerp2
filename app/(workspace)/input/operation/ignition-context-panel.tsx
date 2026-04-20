'use client';

import { useMemo } from 'react';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { useOpContext } from './op-context-store';
import { fmtDate } from '@/lib/utils';
import { EmptyState } from '@/components/shared/empty-state';
import type { RtdbEvent } from '@/lib/types/rtdb-entities';

export function IgnitionContextPanel() {
  const { carNumber } = useOpContext();
  const events = useRtdbCollection<RtdbEvent>('events');

  const history = useMemo(() => {
    if (!carNumber) return [];
    return events.data
      .filter((e) => e.car_number === carNumber && e.type === 'ignition' && e.status !== 'deleted')
      .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  }, [events.data, carNumber]);

  if (!carNumber) {
    return <EmptyState icon="ph-cursor-click" title="차량을 선택하면 시동제어 이력이 표시됩니다" />;
  }

  if (history.length === 0) {
    return <EmptyState icon="ph-engine" title={`${carNumber} 시동제어 이력 없음`} />;
  }

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ position: 'sticky', top: 0, background: 'var(--c-bg-sub)' }}>
          <tr className="text-xs text-text-sub" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500 }}>일자</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500 }}>조치</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500 }}>사유</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500 }}>담당</th>
          </tr>
        </thead>
        <tbody>
          {history.map((e) => {
            const action = String((e as Record<string, unknown>).ignition_action ?? '');
            const reason = String((e as Record<string, unknown>).ignition_reason ?? '');
            const isLock = action === '시동제어';
            return (
              <tr key={e._key} style={{ borderBottom: '1px solid var(--c-border)' }}>
                <td className="text-xs" style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtDate(String(e.date ?? ''))}
                </td>
                <td className="text-xs" style={{ padding: '6px 8px', fontWeight: 600, color: isLock ? 'var(--c-danger)' : 'var(--c-success)' }}>
                  {action || '—'}
                </td>
                <td className="text-xs text-text-sub" style={{ padding: '6px 8px' }}>
                  {reason || '—'}
                </td>
                <td className="text-xs text-text-muted" style={{ padding: '6px 8px' }}>
                  {(e as Record<string, unknown>).handler as string ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
