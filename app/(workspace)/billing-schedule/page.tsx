'use client';

import { JpkGrid, type JpkGridApi } from '@/components/shared/jpk-grid';
import { Workspace } from '@/components/shared/panel';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { computeTotalDue, today } from '@/lib/date-utils';
import type { RtdbBilling } from '@/lib/types/rtdb-entities';
import { fmt } from '@/lib/utils';
import { useMemo, useRef, useState } from 'react';
import { BillingScheduleClient, type ScheduleRow } from './billing-schedule-client';

export default function BillingSchedulePage() {
  const billings = useRtdbCollection<RtdbBilling>('billings');
  const gridRef = useRef<JpkGridApi<ScheduleRow> | null>(null);
  const [selected, setSelected] = useState<ScheduleRow | null>(null);

  const t = today();

  // 선택된 계약의 billing 상세
  const detailBillings = useMemo(() => {
    if (!selected) return [];
    return billings.data
      .filter((b) => b.contract_code === selected.contract_code && b.status !== 'deleted')
      .sort((a, b) => {
        const aType = (a as Record<string, unknown>).bill_type === '보증금' ? 0 : 1;
        const bType = (b as Record<string, unknown>).bill_type === '보증금' ? 0 : 1;
        if (aType !== bType) return aType - bType;
        return (a.bill_count ?? 0) - (b.bill_count ?? 0);
      });
  }, [billings.data, selected]);

  return (
    <Workspace layout="layout-55">
      {/* 좌측: 계약별 수납스케줄 목록 */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <i className="ph ph-calendar-check" />
            <span className="panel-title">수납 스케줄</span>
            <span className="panel-subtitle">계약별 납부 현황</span>
          </div>
        </div>
        <div className="panel-body no-pad" style={{ overflow: 'hidden' }}>
          <BillingScheduleClient gridRef={gridRef} onRowClick={(row) => setSelected(row)} />
        </div>
      </section>

      {/* 우측: 선택 계약의 회차별 스케줄 */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <i className="ph ph-list-numbers" />
            <span className="panel-title">스케줄 상세</span>
            <span className="panel-subtitle">
              {selected
                ? `${selected.car_number} · ${selected.contractor_name}`
                : '계약을 선택하세요'}
            </span>
          </div>
        </div>
        <div className="panel-body no-pad" style={{ overflow: 'auto' }}>
          {!selected ? (
            <div
              className="flex items-center justify-center text-text-muted"
              style={{ height: '100%' }}
            >
              <div className="text-xs" style={{ textAlign: 'center' }}>
                <i
                  className="ph ph-cursor-click"
                  style={{ fontSize: 32, display: 'block', marginBottom: 8 }}
                />
                좌측에서 계약을 선택하면
                <br />
                회차별 스케줄이 표시됩니다
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--c-bg-sub)' }}>
                <tr
                  className="text-xs text-text-sub"
                  style={{ borderBottom: '1px solid var(--c-border)' }}
                >
                  <th
                    style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 500, width: 50 }}
                  >
                    구분
                  </th>
                  <th
                    style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 500, width: 40 }}
                  >
                    회차
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 500 }}>
                    납부예정일
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500 }}>금액</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500 }}>
                    납부액
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 500 }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {detailBillings.map((b) => {
                  const due = computeTotalDue(b);
                  const paid = Number(b.paid_total) || 0;
                  const isPaid = paid >= due;
                  const isOverdue = !isPaid && b.due_date && b.due_date < t;
                  return (
                    <tr key={b._key} style={{ borderBottom: '1px solid var(--c-border)' }}>
                      <td className="text-xs" style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <span
                          className={`jpk-pill ${(b as Record<string, unknown>).bill_type === '보증금' ? 'tone-primary' : 'tone-neutral'}`}
                        >
                          {String((b as Record<string, unknown>).bill_type ?? '대여료')}
                        </span>
                      </td>
                      <td
                        className="text-xs text-text-muted"
                        style={{
                          padding: '6px 8px',
                          textAlign: 'center',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {b.bill_count}
                      </td>
                      <td
                        className="text-xs"
                        style={{
                          padding: '6px 8px',
                          textAlign: 'center',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {b.due_date}
                      </td>
                      <td
                        className="text-xs"
                        style={{
                          padding: '6px 8px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {fmt(due)}
                      </td>
                      <td
                        className="text-xs"
                        style={{
                          padding: '6px 8px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                          color: isPaid ? 'var(--c-success)' : 'var(--c-text-muted)',
                        }}
                      >
                        {paid > 0 ? fmt(paid) : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <span
                          className={`jpk-pill ${isPaid ? 'tone-success' : isOverdue ? 'tone-danger' : 'tone-neutral'}`}
                        >
                          {isPaid ? '납부' : isOverdue ? '연체' : '예정'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </Workspace>
  );
}
