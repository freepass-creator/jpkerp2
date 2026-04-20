'use client';

import { useMemo } from 'react';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { useAssetByCar } from '@/lib/hooks/useLookups';
import { useOpContext } from './op-context-store';
import { computeTotalDue, normalizeDate, computeContractEnd, today, daysBetween } from '@/lib/date-utils';
import { metaFor } from '@/lib/event-meta';
import { EmptyState } from '@/components/shared/empty-state';
import type { RtdbBilling, RtdbContract, RtdbEvent } from '@/lib/types/rtdb-entities';
import { fmt, fmtDate } from '@/lib/utils';

/**
 * Panel3 (우측) — 입력 중인 차량의 컨텍스트:
 *   - 차량 기본 정보
 *   - 활성 계약 + 만기 정보
 *   - 수납 요약
 *   - 최근 운영이력 5건
 */
export function OpContextPanel() {
  const { carNumber } = useOpContext();
  const contracts = useRtdbCollection<RtdbContract>('contracts');
  const billings = useRtdbCollection<RtdbBilling>('billings');
  const events = useRtdbCollection<RtdbEvent>('events');

  const asset = useAssetByCar(carNumber);

  const contract = useMemo(
    () =>
      contracts.data.find(
        (c) =>
          c.car_number === carNumber &&
          c.status !== 'deleted' &&
          c.contractor_name?.trim() &&
          (() => {
            const s = normalizeDate(c.start_date);
            const e = computeContractEnd(c);
            const t = today();
            if (!s || s > t) return false;
            return !e || e >= t;
          })(),
      ),
    [contracts.data, carNumber],
  );

  const carBillings = useMemo(() => {
    if (!contract?.contract_code) return [] as RtdbBilling[];
    return billings.data.filter((b) => b.contract_code === contract.contract_code);
  }, [billings.data, contract?.contract_code]);

  const billSummary = useMemo(() => {
    const t = today();
    let totalDue = 0;
    let totalPaid = 0;
    let unpaidCount = 0;
    let maxOverdue = 0;
    for (const b of carBillings) {
      const due = computeTotalDue(b);
      const paid = Number(b.paid_total) || 0;
      totalDue += due;
      totalPaid += paid;
      if (paid < due && b.due_date && b.due_date < t) {
        unpaidCount++;
        const od = daysBetween(b.due_date, t);
        if (od > maxOverdue) maxOverdue = od;
      }
    }
    return { totalDue, totalPaid, unpaidCount, unpaid: totalDue - totalPaid, maxOverdue };
  }, [carBillings]);

  const carEvents = useMemo(
    () =>
      events.data
        .filter((e) => e.car_number === carNumber && e.status !== 'deleted')
        .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))),
    [events.data, carNumber],
  );

  if (!carNumber) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 text-text-muted"
        style={{ padding: 24, height: '100%' }}
      >
        <i className="ph ph-identification-card" style={{ fontSize: 32 }} />
        <div className="text-xs">차량번호 입력 시<br />계약 · 수납 · 운영이력이 여기 표시됩니다.</div>
      </div>
    );
  }

  if (!asset && !contract) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 text-text-muted"
        style={{ padding: 24, height: '100%' }}
      >
        <i className="ph ph-warning-circle text-[24px]" />
        <div className="text-xs">{carNumber} — 등록되지 않은 차량</div>
      </div>
    );
  }

  const contractEnd = contract ? computeContractEnd(contract) : '';
  const dDay = contractEnd ? daysBetween(today(), contractEnd) : null;

  return (
    <div className="overflow-y-auto scrollbar-thin" style={{ padding: 16, height: '100%' }}>
      {/* 차량 정보 */}
      {asset && (
        <section className="form-section" style={{ paddingTop: 0 }}>
          <div className="form-section-title">
            <i className="ph ph-car" />차량
          </div>
          <div className="text-xl" style={{ fontWeight: 600 }}>{asset.car_number}</div>
          <div className="text-text-sub text-xs" style={{ marginTop: 2 }}>
            {[asset.manufacturer, asset.car_model, asset.car_year].filter(Boolean).join(' · ')}
          </div>
          {asset.detail_model && (
            <div className="text-text-muted text-xs">{asset.detail_model}</div>
          )}
          <div className="text-text-muted text-xs" style={{ marginTop: 4 }}>
            {asset.partner_code ?? '-'} · {asset.fuel_type ?? ''} · {asset.ext_color ?? ''}
          </div>
        </section>
      )}

      {/* 활성 계약 */}
      <section className="form-section">
        <div className="form-section-title">
          <i className="ph ph-handshake" />계약
          {dDay !== null && (
            <span
              className="badge"
              style={{
                marginLeft: 'auto',
                color: dDay < 0 ? 'var(--c-danger)' : dDay <= 30 ? 'var(--c-warn)' : 'var(--c-success)',
              }}
            >
              {dDay < 0 ? `만기 ${-dDay}일 경과` : `D-${dDay}`}
            </span>
          )}
        </div>
        {contract ? (
          <>
            <div className="text-xl" style={{ fontWeight: 600 }}>{contract.contractor_name}</div>
            <div className="text-text-sub text-xs" style={{ marginTop: 2 }}>
              {contract.contractor_phone} · {contract.contract_code}
            </div>
            <div className="text-text-muted text-xs" style={{ marginTop: 4 }}>
              {normalizeDate(contract.start_date)} ~ {contractEnd} · {contract.rent_months}개월 · 월 {fmt(Number(contract.rent_amount))}원
            </div>
          </>
        ) : (
          <div className="text-text-muted text-xs">활성 계약 없음</div>
        )}
      </section>

      {/* 수납 요약 */}
      {contract && (
        <section className="form-section">
          <div className="form-section-title">
            <i className="ph ph-currency-krw" />수납
            {billSummary.unpaidCount > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: 'auto' }}>
                {billSummary.unpaidCount}회 미납
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-text-muted">누적 청구</div>
              <div className="num" style={{ fontWeight: 600 }}>{fmt(billSummary.totalDue)}원</div>
            </div>
            <div>
              <div className="text-text-muted">누적 수납</div>
              <div className="num text-success" style={{ fontWeight: 600 }}>
                {fmt(billSummary.totalPaid)}원
              </div>
            </div>
            <div>
              <div className="text-text-muted">미납액</div>
              <div
                className="num"
                style={{ fontWeight: 600, color: billSummary.unpaid > 0 ? 'var(--c-danger)' : 'var(--c-text-muted)' }}
              >
                {fmt(billSummary.unpaid)}원
              </div>
            </div>
            <div>
              <div className="text-text-muted">최장 연체</div>
              <div
                className="num"
                style={{ fontWeight: 600, color: billSummary.maxOverdue > 30 ? 'var(--c-danger)' : billSummary.maxOverdue > 7 ? 'var(--c-warn)' : 'var(--c-text-muted)' }}
              >
                {billSummary.maxOverdue ? `${billSummary.maxOverdue}일` : '-'}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 운영이력 */}
      <section className="form-section">
        <div className="form-section-title">
          <i className="ph ph-clock-counter-clockwise" />최근 운영이력
          <span className="text-text-muted text-2xs" style={{ marginLeft: 'auto', fontWeight: 400 }}>
            {carEvents.length > 5 ? `최근 5 / 총 ${carEvents.length}` : `${carEvents.length}건`}
          </span>
        </div>
        {carEvents.length === 0 ? (
          <EmptyState icon="ph-clock-counter-clockwise" title="이력 없음" size="sm" />
        ) : (
          <div className="flex flex-col" style={{ gap: 6 }}>
            {carEvents.slice(0, 5).map((e) => {
              const meta = metaFor(e.type);
              return (
                <div key={e._key} className="flex items-start gap-2 text-xs">
                  <div className="text-text-muted num" style={{ width: 50, flexShrink: 0 }}>
                    {fmtDate(e.date)}
                  </div>
                  <i className={`ph ${meta.icon} text-base`} style={{ color: meta.color, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.title ?? meta.label}
                      {e.amount ? <span className="text-text-muted num" style={{ marginLeft: 6 }}>{fmt(Number(e.amount))}원</span> : null}
                    </div>
                    {e.memo && (
                      <div
                        className="text-text-muted"
                        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {e.memo}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
