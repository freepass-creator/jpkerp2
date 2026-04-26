'use client';

import { EditDialog } from '@/components/shared/edit-dialog';
import type { JpkGridApi } from '@/components/shared/jpk-grid';
import { useAuth } from '@/lib/auth/context';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { parseCsv } from '@/lib/csv';
import { today as todayStr } from '@/lib/date-utils';
import { saveEvent, upsertEventByRawKey } from '@/lib/firebase/events';
import { sanitizeCarNumber } from '@/lib/format-input';
import * as bankShinhan from '@/lib/parsers/bank-shinhan';
import * as cardShinhan from '@/lib/parsers/card-shinhan';
import type { RtdbBilling, RtdbEvent } from '@/lib/types/rtdb-entities';
import { fmt } from '@/lib/utils';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { LedgerClient } from './ledger-client';

type SubpageId = 'finance-list' | 'finance-daily' | 'finance-tax-invoice';

interface TabSpec {
  id: SubpageId;
  label: string;
  primaryAction: string;
  secondaryAction?: string;
}

const TABS: TabSpec[] = [
  {
    id: 'finance-list',
    label: '입출금내역',
    primaryAction: '+ 거래 입력',
    secondaryAction: '+ 수기 입력',
  },
  { id: 'finance-daily', label: '자금일보', primaryAction: '+ 자금일보 작성' },
  { id: 'finance-tax-invoice', label: '세금계산서', primaryAction: '+ 계산서 발행' },
];

const TAB_CRUMB: Record<SubpageId, string> = {
  'finance-list': '입출금내역',
  'finance-daily': '자금일보',
  'finance-tax-invoice': '세금계산서',
};

/** URL `?tab=` 약자 → 내부 SubpageId */
const TAB_ALIAS: Record<string, SubpageId> = {
  list: 'finance-list',
  bank: 'finance-list',
  daily: 'finance-daily',
  'tax-invoice': 'finance-tax-invoice',
  tax: 'finance-tax-invoice',
};

export default function FinancePage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') ?? '';
  const filterParam = searchParams.get('filter') ?? '';
  const initialTab = TAB_ALIAS[tabParam] ?? 'finance-list';

  const gridRef = useRef<JpkGridApi<RtdbEvent> | null>(null);
  const [active, setActive] = useState<SubpageId>(initialTab);
  const [count, setCount] = useState(0);
  const [csvOpen, setCsvOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);

  const events = useRtdbCollection<RtdbEvent>('events');
  const billings = useRtdbCollection<RtdbBilling>('billings');

  // biome-ignore lint/correctness/useExhaustiveDependencies: tabParam만 추적
  useEffect(() => {
    const next = TAB_ALIAS[tabParam];
    if (next && next !== active) setActive(next);
  }, [tabParam]);

  const alerts = useMemo(
    () => deriveFinanceAlerts(events.data, billings.data),
    [events.data, billings.data],
  );
  const stats = useMemo(() => deriveFinanceStats(events.data), [events.data]);
  const dailyRows = useMemo(() => deriveDailyRows(events.data), [events.data]);

  const activeTab = TABS.find((t) => t.id === active) ?? TABS[0];

  const onPrimary = () => {
    if (active === 'finance-list') setCsvOpen(true);
    else if (active === 'finance-daily') setDailyOpen(true);
    else toast.info('세금계산서는 아래 카드에서 발행하세요');
  };

  return (
    <>
      <div className="page-head">
        <i className="ph ph-coins" />
        <div className="title">재무관리</div>
        <div className="crumbs">› {TAB_CRUMB[active]}</div>
      </div>

      <div className="v3-tabs">
        <div className="v3-tab-list">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`v3-tab ${active === t.id ? 'is-active' : ''}`}
              onClick={() => setActive(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="action">
          <button type="button" onClick={onPrimary}>
            {activeTab.primaryAction}
          </button>
          {activeTab.secondaryAction && (
            <button type="button" className="is-secondary" onClick={() => setManualOpen(true)}>
              {activeTab.secondaryAction}
            </button>
          )}
        </div>
      </div>

      <CsvUploadDialog open={csvOpen} onClose={() => setCsvOpen(false)} />
      <ManualTxDialog open={manualOpen} onClose={() => setManualOpen(false)} />
      <DailyReportDialog
        open={dailyOpen}
        onClose={() => setDailyOpen(false)}
        events={events.data}
      />

      {active === 'finance-list' ? (
        <FinanceListSubpage
          loading={events.loading}
          error={events.error}
          alerts={alerts}
          stats={stats}
          gridRef={gridRef}
          onCountChange={setCount}
          count={count}
          filter={filterParam}
        />
      ) : active === 'finance-daily' ? (
        <DailyReportSubpage
          rows={dailyRows}
          loading={events.loading}
          events={events.data}
          onWriteClick={() => setDailyOpen(true)}
        />
      ) : (
        <TaxInvoiceSubpage events={events.data} billings={billings.data} />
      )}
    </>
  );
}

/* ── 입출금내역 sub-page ── */
function FinanceListSubpage({
  loading,
  error,
  alerts,
  stats,
  gridRef,
  onCountChange,
  count,
  filter,
}: {
  loading: boolean;
  error: Error | null;
  alerts: AlertItem[];
  stats: FinanceStats;
  gridRef: React.RefObject<JpkGridApi<RtdbEvent> | null>;
  onCountChange: (n: number) => void;
  count: number;
  filter?: string;
}) {
  // filter='unmatched' → 미매칭 행만 표시 hint (현재는 표시만)
  void filter;
  const isClear = alerts.length === 0;
  const totalAlerts = alerts.reduce((sum, a) => sum + a.count, 0);

  return (
    <div className="v3-subpage is-active">
      {/* 미결 패널 */}
      <div className={`v3-alerts ${isClear ? 'is-clear' : ''}`}>
        <div className="v3-alerts-head">
          <span className="dot" />
          <span className="title">{isClear ? '재무 미결 없음' : '재무 미결'}</span>
          <span className="count">{isClear ? '· 0건' : `· ${totalAlerts}건`}</span>
        </div>
        {!isClear && (
          <div className="v3-alerts-grid">
            {alerts.map((a) => (
              <div
                key={a.key}
                className={`v3-alert-card ${a.severity === 'danger' ? 'is-danger' : a.severity === 'info' ? 'is-info' : ''}`}
              >
                <i className={`ph ${a.icon} ico`} />
                <div className="body">
                  <div className="head">{a.head}</div>
                  <div className="desc">{a.desc}</div>
                </div>
                <button type="button" className="alert-btn">
                  {a.actionLabel}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AG Grid (LedgerClient wrap) */}
      <div className="v3-table-wrap">
        {loading ? (
          <div className="v3-loading">
            <i className="ph ph-spinner spin" /> 입출금 데이터 로드 중...
          </div>
        ) : error ? (
          <div className="v3-error-box">
            <div className="head">데이터 로드 실패</div>
            <div className="msg">{error.message}</div>
          </div>
        ) : (
          <div className="v3-grid-host">
            <LedgerClient gridRef={gridRef} onCountChange={onCountChange} />
          </div>
        )}
      </div>

      {/* table-foot: 수입·지출·예수금 합계 */}
      <div className="v3-table-foot">
        <div>
          총 {count || stats.total}건<span className="sep">│</span>
          수입 <span className="v3-stat-pos">+{fmt(stats.inflow)}</span>
          <span className="sep">│</span>
          지출 <span className="v3-stat-neg">-{fmt(stats.outflow)}</span>
          <span className="sep">│</span>
          <span className="v3-stat-mut">미매칭 {stats.unmatched}건</span>
        </div>
        <div className="v3-stat-mut">행 클릭 시 거래 매칭</div>
      </div>
    </div>
  );
}

/* ── 자금일보 sub-page (작성 모달 호출 + 일자별 합계) ── */
function DailyReportSubpage({
  rows,
  loading,
  events,
  onWriteClick,
}: {
  rows: DailyRow[];
  loading: boolean;
  events: readonly RtdbEvent[];
  onWriteClick: () => void;
}) {
  const tStr = todayStr();
  // 자금일보 작성 여부는 daily_finance_report 이벤트로 판단 (rows는 거래 derive)
  const todayReportWritten = events.some(
    (e) =>
      e.date === tStr &&
      (e.type === 'daily_finance_report' || e.type === 'fund_daily') &&
      e.status !== 'deleted',
  );
  const todayHasTx = rows.some((r) => r.date === tStr);

  return (
    <div className="v3-subpage is-active">
      <div className={`v3-alerts ${todayReportWritten ? 'is-clear' : ''}`}>
        <div className="v3-alerts-head">
          <span className="dot" />
          <span className="title">
            {todayReportWritten ? `자금일보 — ${tStr} 작성 완료` : '자금일보 미작성'}
          </span>
          <span className="count">
            {todayReportWritten
              ? `· ${rows.find((r) => r.date === tStr)?.count ?? 0}건 거래`
              : `· 오늘(${tStr}) 자금일보 필요${todayHasTx ? ' · 거래 있음' : ''}`}
          </span>
        </div>
        {!todayReportWritten && (
          <div className="v3-alerts-grid">
            <div className="v3-alert-card is-danger">
              <i className="ph ph-coins ico" />
              <div className="body">
                <div className="head">오늘 자금일보 미작성</div>
                <div className="desc">거래 입력 후 자금일보 작성 → 일자별 수입·지출 마감</div>
              </div>
              <button type="button" className="alert-btn" onClick={onWriteClick}>
                작성
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="v3-table-wrap">
        {loading ? (
          <div className="v3-loading">
            <i className="ph ph-spinner spin" /> 자금일보 데이터 로드 중...
          </div>
        ) : rows.length === 0 ? (
          <div className="v3-loading">거래 데이터가 없습니다.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr
                style={{
                  background: 'var(--c-bg-soft)',
                  borderBottom: '1px solid var(--c-border)',
                }}
              >
                <th style={cellTh(96)}>일자</th>
                <th style={{ ...cellTh(96), textAlign: 'right' }}>수입</th>
                <th style={{ ...cellTh(96), textAlign: 'right' }}>지출</th>
                <th style={{ ...cellTh(96), textAlign: 'right' }}>순익</th>
                <th style={cellTh(64)}>거래수</th>
                <th style={cellTh(72)}>미매칭</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 60).map((r) => (
                <tr key={r.date} style={{ borderBottom: '1px solid var(--c-border)' }}>
                  <td style={cellTd()}>{r.date}</td>
                  <td
                    style={{
                      ...cellTd(),
                      textAlign: 'right',
                      color: 'var(--c-emerald)',
                      fontWeight: 600,
                    }}
                  >
                    +{fmt(r.inflow)}
                  </td>
                  <td
                    style={{
                      ...cellTd(),
                      textAlign: 'right',
                      color: 'var(--c-err)',
                      fontWeight: 600,
                    }}
                  >
                    -{fmt(r.outflow)}
                  </td>
                  <td style={{ ...cellTd(), textAlign: 'right', fontWeight: 600 }}>
                    {r.inflow - r.outflow >= 0 ? '+' : ''}
                    {fmt(r.inflow - r.outflow)}
                  </td>
                  <td style={cellTd()}>{r.count}</td>
                  <td
                    style={{
                      ...cellTd(),
                      color: r.unmatched > 0 ? 'var(--c-warn)' : 'var(--c-text-muted)',
                    }}
                  >
                    {r.unmatched}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="v3-table-foot">
        <div>
          최근 {Math.min(rows.length, 60)}일 일자별 거래 자동 집계
          <span className="sep">│</span>
          <span className="v3-stat-mut">(자금일보 events 도입 전 — 거래 데이터 자동 derive)</span>
        </div>
      </div>
    </div>
  );
}

/* ── 세금계산서 sub-page (회원사·월별 derived) ── */
function TaxInvoiceSubpage({
  events,
  billings,
}: {
  events: readonly RtdbEvent[];
  billings: readonly RtdbBilling[];
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const tStr = todayStr();
  const thisMonth = tStr.slice(0, 7);
  const [ym, setYm] = useState(thisMonth);

  // 회원사·월별 수납 합계 derive
  const partnerRows = useMemo(() => {
    const map = new Map<string, { partner_code: string; total: number; bills: number }>();
    for (const b of billings) {
      if (!b.partner_code) continue;
      const paid = Number(b.paid_total ?? 0);
      if (paid <= 0) continue;
      if (!(b.due_date ?? '').startsWith(ym)) continue;
      const r = map.get(b.partner_code) ?? { partner_code: b.partner_code, total: 0, bills: 0 };
      r.total += paid;
      r.bills += 1;
      map.set(b.partner_code, r);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [billings, ym]);

  const issuedSet = useMemo(() => {
    const s = new Set<string>();
    for (const e of events) {
      if (e.type !== 'tax_invoice' || e.status === 'deleted') continue;
      if (!(e.date ?? '').startsWith(ym)) continue;
      const pc = (e as { partner_code?: string }).partner_code;
      if (pc) s.add(pc);
    }
    return s;
  }, [events, ym]);

  const onIssue = async (partner_code: string, total: number) => {
    setBusy(partner_code);
    try {
      await saveEvent({
        type: 'tax_invoice',
        date: tStr,
        title: `${partner_code} ${ym} 세금계산서`,
        partner_code,
        // 아래 필드는 RtdbEvent 명시 안 됨 — Phase 2에서 e세로 연동시 정형화
        amount: total,
        // ym/total/status는 indexed signature로 저장됨
        ym,
        total,
        memo: 'manual_recorded',
        match_status: 'manual_recorded',
        handler_uid: user?.uid,
        handler: user?.displayName ?? user?.email ?? undefined,
      } as Partial<RtdbEvent> & { type: string });
      toast.success(`${partner_code} ${ym} 세금계산서 발행 기록 완료`);
    } catch (e) {
      toast.error(`발행 실패: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const unissued = partnerRows.filter((r) => !issuedSet.has(r.partner_code));
  const issued = partnerRows.filter((r) => issuedSet.has(r.partner_code));

  return (
    <div className="v3-subpage is-active">
      <div className={`v3-alerts ${unissued.length === 0 ? 'is-clear' : ''}`}>
        <div className="v3-alerts-head">
          <span className="dot" />
          <span className="title">
            세금계산서 — {ym} {unissued.length === 0 ? '발행 완료' : `미발행 ${unissued.length}건`}
          </span>
          <span className="count">
            · 회원사 {partnerRows.length}곳 · 발행 {issued.length} / 미발행 {unissued.length}
          </span>
        </div>
        <div style={{ padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--c-text-sub)' }}>대상월</span>
          <input
            type="month"
            value={ym}
            onChange={(e) => setYm(e.target.value)}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--c-border)',
              fontSize: 12,
              background: 'var(--c-surface)',
              color: 'var(--c-text)',
              borderRadius: 2,
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
            (e세로 API 연동은 Phase 2 — 현재는 발행 기록만)
          </span>
        </div>
      </div>

      <div className="v3-table-wrap">
        {partnerRows.length === 0 ? (
          <div className="v3-loading">{ym} 월 수납 회원사가 없습니다.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr
                style={{
                  background: 'var(--c-bg-soft)',
                  borderBottom: '1px solid var(--c-border)',
                }}
              >
                <th style={cellTh(120)}>회원사</th>
                <th style={cellTh(72)}>청구건</th>
                <th style={{ ...cellTh(120), textAlign: 'right' }}>수납합계</th>
                <th style={cellTh(96)}>발행상태</th>
                <th style={cellTh(96)}>액션</th>
              </tr>
            </thead>
            <tbody>
              {partnerRows.map((r) => {
                const isIssued = issuedSet.has(r.partner_code);
                return (
                  <tr key={r.partner_code} style={{ borderBottom: '1px solid var(--c-border)' }}>
                    <td style={cellTd()}>{r.partner_code}</td>
                    <td style={cellTd()}>{r.bills}건</td>
                    <td style={{ ...cellTd(), textAlign: 'right', fontWeight: 600 }}>
                      {fmt(r.total)}
                    </td>
                    <td style={cellTd()}>
                      {isIssued ? (
                        <span style={{ color: 'var(--c-emerald)' }}>발행 완료</span>
                      ) : (
                        <span style={{ color: 'var(--c-warn)' }}>미발행</span>
                      )}
                    </td>
                    <td style={cellTd()}>
                      {isIssued ? (
                        <span style={{ color: 'var(--c-text-muted)' }}>—</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onIssue(r.partner_code, r.total)}
                          disabled={busy === r.partner_code}
                          style={{
                            padding: '4px 12px',
                            background: 'var(--c-accent)',
                            color: 'var(--c-text-inv)',
                            border: '1px solid var(--c-accent)',
                            borderRadius: 2,
                            cursor: 'pointer',
                            fontSize: 11,
                          }}
                        >
                          {busy === r.partner_code ? '발행 중...' : '발행'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="v3-table-foot">
        <div>
          {ym} 월 수납분 — 회원사별 합계
          <span className="sep">│</span>
          <span className="v3-stat-mut">발행은 events.type=tax_invoice 이벤트로 기록</span>
        </div>
      </div>
    </div>
  );
}

/* ── 자금일보 작성 모달 ── */
function DailyReportDialog({
  open,
  onClose,
  events,
}: {
  open: boolean;
  onClose: () => void;
  events: readonly RtdbEvent[];
}) {
  const { user } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);

  // 해당 일자의 거래 자동 집계
  const summary = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    let count = 0;
    let matched = 0;
    for (const e of events) {
      if (e.type !== 'bank_tx' && e.type !== 'card_tx') continue;
      if (e.status === 'deleted') continue;
      if ((e.date ?? '').slice(0, 10) !== date) continue;
      count += 1;
      const amt = Number(e.amount ?? 0);
      if (amt > 0) inflow += amt;
      else outflow += -amt;
      if (e.match_status === 'matched') matched += 1;
    }
    const matchRate = count > 0 ? Math.round((matched / count) * 100) : 0;
    return { inflow, outflow, count, matched, matchRate };
  }, [events, date]);

  // 이미 작성된 일자 확인
  const alreadyWritten = useMemo(
    () =>
      events.some(
        (e) =>
          (e.type === 'daily_finance_report' || e.type === 'fund_daily') &&
          e.date === date &&
          e.status !== 'deleted',
      ),
    [events, date],
  );

  const reset = () => {
    setDate(todayStr());
    setMemo('');
  };

  const onSave = async () => {
    if (!date) {
      toast.error('일자를 선택하세요');
      return;
    }
    if (alreadyWritten) {
      toast.error(`${date} 자금일보가 이미 작성됨`);
      return;
    }
    setBusy(true);
    try {
      await saveEvent({
        type: 'daily_finance_report',
        date,
        title: `자금일보 ${date}`,
        amount: summary.inflow - summary.outflow,
        memo: memo || undefined,
        // 집계 결과 보존
        inflow: summary.inflow,
        outflow: summary.outflow,
        tx_count: summary.count,
        matched_count: summary.matched,
        match_rate: summary.matchRate,
        handler_uid: user?.uid,
        handler: user?.displayName ?? user?.email ?? undefined,
      } as Partial<RtdbEvent> & { type: string });
      toast.success(`자금일보 ${date} 작성 완료`);
      reset();
      onClose();
    } catch (e) {
      toast.error(`저장 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <EditDialog
      open={open}
      title="자금일보 작성"
      subtitle="일자별 수입·지출·매칭률 자동 집계 + 마감"
      onClose={() => {
        reset();
        onClose();
      }}
      onSave={onSave}
      saving={busy}
      width={520}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          <div style={lblStyle()}>일자 *</div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle()}
          />
        </label>

        <div
          style={{
            border: '1px solid var(--c-border)',
            background: 'var(--c-bg-soft)',
            padding: 12,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            fontSize: 12,
          }}
        >
          <div>
            <div style={{ color: 'var(--c-text-sub)', fontSize: 11 }}>수입</div>
            <div style={{ color: 'var(--c-emerald)', fontWeight: 600, fontSize: 14 }}>
              +{fmt(summary.inflow)}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--c-text-sub)', fontSize: 11 }}>지출</div>
            <div style={{ color: 'var(--c-err)', fontWeight: 600, fontSize: 14 }}>
              -{fmt(summary.outflow)}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--c-text-sub)', fontSize: 11 }}>거래수</div>
            <div style={{ fontWeight: 600 }}>{summary.count}건</div>
          </div>
          <div>
            <div style={{ color: 'var(--c-text-sub)', fontSize: 11 }}>매칭률</div>
            <div style={{ fontWeight: 600 }}>
              {summary.matched} / {summary.count} ({summary.matchRate}%)
            </div>
          </div>
        </div>

        <label>
          <div style={lblStyle()}>메모</div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            placeholder="특이사항·결산 요약"
            style={inputStyle()}
          />
        </label>

        {alreadyWritten && (
          <div style={{ color: 'var(--c-warn)', fontSize: 12 }}>
            ⚠ {date} 자금일보가 이미 작성되어 있습니다.
          </div>
        )}
      </div>
    </EditDialog>
  );
}

/* ═════════ 미결 derive 로직 ═════════ */

type AlertSeverity = 'danger' | 'warn' | 'info';
interface AlertItem {
  key: string;
  severity: AlertSeverity;
  icon: string;
  head: string;
  desc: string;
  actionLabel: string;
  count: number;
}

function deriveFinanceAlerts(
  events: readonly RtdbEvent[],
  billings: readonly RtdbBilling[],
): AlertItem[] {
  const out: AlertItem[] = [];
  const tStr = todayStr();

  // 1) 자금일보 미작성 — 오늘 daily_finance_report 이벤트 없으면
  const todayReport = events.some((e) => e.date === tStr && isDailyFinanceReport(e.type));
  if (!todayReport) {
    out.push({
      key: 'no-daily-report',
      severity: 'danger',
      icon: 'ph-coins',
      head: '자금일보 미작성',
      desc: `오늘(${tStr}) 자금일보가 아직 작성되지 않음`,
      actionLabel: '작성',
      count: 1,
    });
  }

  // 2) 예수금 매칭 대기 — type='bank_tx' AND no contract_code AND no match
  const unmatchedDeposit = events.filter(
    (e) =>
      e.type === 'bank_tx' &&
      e.status !== 'deleted' &&
      Number(e.amount ?? 0) > 0 &&
      !nonEmpty(e.contract_code) &&
      e.match_status !== 'matched' &&
      e.match_status !== 'ignored',
  );
  if (unmatchedDeposit.length > 0) {
    const desc = unmatchedDeposit
      .slice(0, 3)
      .map((e) => `${e.title ?? '—'} ${fmt(Number(e.amount ?? 0))}`)
      .join(' · ');
    out.push({
      key: 'deposit-unmatched',
      severity: 'warn',
      icon: 'ph-link',
      head: `예수금 매칭 [${unmatchedDeposit.length}]`,
      desc: `${desc}${unmatchedDeposit.length > 3 ? ` 외 ${unmatchedDeposit.length - 3}건` : ''} — 신한 입금 중 미매칭`,
      actionLabel: '매칭',
      count: unmatchedDeposit.length,
    });
  }

  // 3) 과태료 미처리 — type='penalty' AND status pending
  const pendingPenalty = events.filter(
    (e) =>
      e.type === 'penalty' && e.status !== 'deleted' && isPendingStatus(e.work_status ?? e.status),
  );
  if (pendingPenalty.length > 0) {
    out.push({
      key: 'penalty-pending',
      severity: 'info',
      icon: 'ph-file-text',
      head: `과태료 미처리 [${pendingPenalty.length}]`,
      desc: `${pendingPenalty
        .slice(0, 4)
        .map((e) => e.car_number ?? '—')
        .join(' · ')}${
        pendingPenalty.length > 4 ? ` 외 ${pendingPenalty.length - 4}건` : ''
      } (스캔 후 변경부과 대기)`,
      actionLabel: '처리',
      count: pendingPenalty.length,
    });
  }

  // 4) 세금계산서 미발행 — billings 수납분 vs tax_invoice 이벤트 비교 (월별)
  // 간단 derive: 이번달 paid billings 중 tax_invoice 이벤트 없는 partner_code 그룹화
  const thisMonth = tStr.slice(0, 7); // YYYY-MM
  const issuedPartners = new Set(
    events
      .filter(
        (e) =>
          e.type === 'tax_invoice' &&
          e.status !== 'deleted' &&
          (e.date ?? '').startsWith(thisMonth),
      )
      .map((e) => e.partner_code)
      .filter((v): v is string => Boolean(v)),
  );
  const partnersWithRevenue = new Set<string>();
  for (const b of billings) {
    if (!b.partner_code) continue;
    const paid = Number(b.paid_total ?? 0);
    if (paid <= 0) continue;
    if ((b.due_date ?? '').startsWith(thisMonth)) {
      partnersWithRevenue.add(b.partner_code);
    }
  }
  const unissued = Array.from(partnersWithRevenue).filter((p) => !issuedPartners.has(p));
  if (unissued.length > 0) {
    out.push({
      key: 'tax-invoice-unissued',
      severity: 'info',
      icon: 'ph-receipt',
      head: `세금계산서 미발행 [${unissued.length}]`,
      desc: `${unissued
        .slice(0, 4)
        .map((p) => `${p} ${thisMonth} 분`)
        .join(
          ' · ',
        )}${unissued.length > 4 ? ` 외 ${unissued.length - 4}건` : ''} — 마감 ${monthEnd(thisMonth)}`,
      actionLabel: '발행',
      count: unissued.length,
    });
  }

  return out;
}

interface FinanceStats {
  total: number;
  inflow: number;
  outflow: number;
  unmatched: number;
}

function deriveFinanceStats(events: readonly RtdbEvent[]): FinanceStats {
  let inflow = 0;
  let outflow = 0;
  let unmatched = 0;
  let total = 0;
  for (const e of events) {
    if (e.type !== 'bank_tx' && e.type !== 'card_tx') continue;
    if (e.status === 'deleted') continue;
    total += 1;
    const amt = Number(e.amount ?? 0);
    if (amt > 0) inflow += amt;
    else outflow += -amt;
    if (e.match_status !== 'matched') unmatched += 1;
  }
  return { total, inflow, outflow, unmatched };
}

interface DailyRow {
  date: string;
  inflow: number;
  outflow: number;
  count: number;
  unmatched: number;
}

function deriveDailyRows(events: readonly RtdbEvent[]): DailyRow[] {
  const map = new Map<string, DailyRow>();
  for (const e of events) {
    if (e.type !== 'bank_tx' && e.type !== 'card_tx') continue;
    if (e.status === 'deleted') continue;
    const date = (e.date ?? '').slice(0, 10);
    if (!date) continue;
    const r = map.get(date) ?? { date, inflow: 0, outflow: 0, count: 0, unmatched: 0 };
    const amt = Number(e.amount ?? 0);
    if (amt > 0) r.inflow += amt;
    else r.outflow += -amt;
    r.count += 1;
    if (e.match_status !== 'matched') r.unmatched += 1;
    map.set(date, r);
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

/* ── helpers ── */

function isDailyFinanceReport(t: unknown): boolean {
  const s = (t ?? '').toString();
  return s === 'daily_finance_report' || s === 'fund_daily' || s.includes('자금일보');
}

function isPendingStatus(v: unknown): boolean {
  if (!nonEmpty(v)) return true; // 상태 비어있으면 미처리로 간주
  const s = String(v).toLowerCase();
  return s.includes('pending') || s.includes('대기') || s.includes('미처리') || s.includes('진행');
}

function nonEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  return String(v).trim().length > 0;
}

function monthEnd(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map((s) => Number.parseInt(s, 10));
  if (!y || !m) return yyyymm;
  const last = new Date(y, m, 0).getDate();
  return `${yyyymm}-${String(last).padStart(2, '0')}`;
}

function cellTh(width?: number): React.CSSProperties {
  return {
    padding: '6px 8px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--c-text-sub)',
    textAlign: 'center',
    width,
  };
}

function cellTd(): React.CSSProperties {
  return {
    padding: '6px 8px',
    textAlign: 'center',
    color: 'var(--c-text)',
  };
}

/* ═════════ CSV 업로드 모달 ═════════ */

type ParsedRow = bankShinhan.BankTxEvent | cardShinhan.CardTxEvent;

function CsvUploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parserName, setParserName] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFile(null);
    setRows([]);
    setParserName('');
  };

  const parseFile = async (f: File) => {
    setFile(f);
    try {
      const text = await f.text();
      const arr = parseCsv(text);
      if (arr.length < 2) {
        toast.error('CSV가 비어있거나 헤더만 있습니다');
        return;
      }
      const headers = arr[0].map((h) => String(h ?? '').trim());
      const dataRows = arr.slice(1);

      let parsed: ParsedRow[] = [];
      let pName = '';

      if (bankShinhan.detect(headers)) {
        pName = bankShinhan.LABEL;
        parsed = dataRows
          .map((r) => bankShinhan.parseRow(r, headers))
          .filter((x): x is bankShinhan.BankTxEvent => !!x);
      } else if (cardShinhan.detect(headers)) {
        pName = cardShinhan.LABEL;
        parsed = dataRows
          .map((r) => cardShinhan.parseRow(r, headers))
          .filter((x): x is cardShinhan.CardTxEvent => !!x);
      } else {
        toast.error('지원하는 CSV 형식이 아닙니다 (신한은행·신한카드만 지원)');
        return;
      }

      setRows(parsed);
      setParserName(pName);
      toast.success(`${pName} CSV ${parsed.length}행 파싱 완료`);
    } catch (err) {
      toast.error(`CSV 파싱 실패: ${(err as Error).message}`);
    }
  };

  const onSave = async () => {
    if (rows.length === 0) {
      toast.error('파싱된 데이터가 없습니다');
      return;
    }
    setBusy(true);
    try {
      let ok = 0;
      const matched = 0;
      for (const r of rows) {
        try {
          await upsertEventByRawKey({
            ...r,
            type: r.type,
            raw_key: r.raw_key,
            title: r.counterparty,
            // 통장 거래의 출금은 음수, 입금은 양수 — bank_tx 파서는 direction='out'이면 amount만 들어옴
            // amount는 부호 없음. 매칭은 파서 result에 amount를 그대로 넘김.
            amount:
              (r as { direction?: string }).direction === 'out' ? -Math.abs(r.amount) : r.amount,
          });
          ok++;
          // upsert 후 reconcile은 events.ts 내부에서 contract_code 있을 때만 실행됨
          // 신규 CSV는 contract_code 없는 상태라 매칭은 별도 단계 필요
        } catch (e) {
          /* per-row 오류는 무시 */
        }
      }
      toast.success(`${ok}건 저장 완료 (자동매칭은 거래처별 매뉴얼 매칭 단계에서 처리)`);
      reset();
      onClose();
    } catch (e) {
      toast.error(`저장 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <EditDialog
      open={open}
      title="CSV 업로드"
      subtitle={parserName ? `감지: ${parserName}` : '신한은행·신한카드 CSV 자동 감지'}
      onClose={() => {
        reset();
        onClose();
      }}
      onSave={onSave}
      saving={busy}
      width={640}
      extraActions={
        <Link href="/upload" className="btn btn-sm btn-outline" style={{ textDecoration: 'none' }}>
          <i className="ph ph-arrow-square-out" />
          상세 업로드 페이지
        </Link>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label
          style={{
            border: '1px dashed var(--c-border)',
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            background: 'var(--c-bg-sub)',
          }}
        >
          <input
            type="file"
            accept=".csv,.tsv,.txt"
            hidden
            onChange={(e) => {
              if (e.target.files?.[0]) parseFile(e.target.files[0]);
              e.target.value = '';
            }}
          />
          <i className="ph ph-file-csv" style={{ fontSize: 24 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{file?.name ?? 'CSV 파일 선택'}</div>
            <div style={{ color: 'var(--c-text-muted)', fontSize: 12 }}>
              신한은행 거래내역 / 신한카드 이용내역 자동 감지
            </div>
          </div>
        </label>

        {rows.length > 0 && (
          <div
            style={{
              border: '1px solid var(--c-border)',
              maxHeight: 280,
              overflowY: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--c-bg-soft)' }}>
                  <th style={cellTh(96)}>일자</th>
                  <th style={{ ...cellTh(), textAlign: 'left' }}>거래처</th>
                  <th style={{ ...cellTh(96), textAlign: 'right' }}>금액</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r) => (
                  <tr key={r.raw_key} style={{ borderTop: '1px solid var(--c-border)' }}>
                    <td style={cellTd()}>{r.date}</td>
                    <td style={{ ...cellTd(), textAlign: 'left' }}>{r.counterparty ?? '—'}</td>
                    <td
                      style={{
                        ...cellTd(),
                        textAlign: 'right',
                        color:
                          (r as { direction?: string }).direction === 'out'
                            ? 'var(--c-err)'
                            : 'var(--c-emerald)',
                      }}
                    >
                      {(r as { direction?: string }).direction === 'out' ? '-' : '+'}
                      {fmt(Math.abs(r.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <div
                style={{
                  padding: 6,
                  textAlign: 'center',
                  color: 'var(--c-text-muted)',
                  fontSize: 11,
                }}
              >
                ... 외 {rows.length - 50}건
              </div>
            )}
          </div>
        )}
      </div>
    </EditDialog>
  );
}

/* ═════════ 수기 거래 입력 모달 ═════════ */

function ManualTxDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [type, setType] = useState<'bank_tx' | 'card_tx'>('bank_tx');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [contractCode, setContractCode] = useState('');
  const [carNumber, setCarNumber] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setType('bank_tx');
    setDirection('in');
    setDate(todayStr());
    setAmount('');
    setCounterparty('');
    setContractCode('');
    setCarNumber('');
    setMemo('');
  };

  const onSave = async () => {
    if (!date) {
      toast.error('일자를 입력하세요');
      return;
    }
    if (!amount) {
      toast.error('금액을 입력하세요');
      return;
    }
    const amt = Number(amount.replace(/[,\s]/g, ''));
    if (!amt || Number.isNaN(amt)) {
      toast.error('금액 형식이 올바르지 않습니다');
      return;
    }

    setBusy(true);
    try {
      const signed = direction === 'out' ? -Math.abs(amt) : Math.abs(amt);
      await saveEvent({
        type,
        source: 'manual',
        direction,
        date,
        amount: signed,
        title: counterparty || '수기 입력',
        counterparty,
        contract_code: contractCode || undefined,
        car_number: carNumber ? sanitizeCarNumber(carNumber) : undefined,
        memo: memo || undefined,
        handler_uid: user?.uid,
        handler: user?.displayName ?? user?.email ?? undefined,
      });
      toast.success(
        contractCode ? '수기 거래 저장 완료 · 청구 자동매칭 시도됨' : '수기 거래 저장 완료',
      );
      reset();
      onClose();
    } catch (e) {
      toast.error(`저장 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <EditDialog
      open={open}
      title="수기 거래 입력"
      subtitle="자금일보 자동매칭이 안 되는 거래를 직접 입력"
      onClose={() => {
        reset();
        onClose();
      }}
      onSave={onSave}
      saving={busy}
      width={520}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ flex: 1 }}>
            <div style={lblStyle()}>거래 유형</div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'bank_tx' | 'card_tx')}
              style={inputStyle()}
            >
              <option value="bank_tx">통장</option>
              <option value="card_tx">카드</option>
            </select>
          </label>
          <label style={{ flex: 1 }}>
            <div style={lblStyle()}>입출금</div>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'in' | 'out')}
              style={inputStyle()}
            >
              <option value="in">입금 (+)</option>
              <option value="out">출금 (-)</option>
            </select>
          </label>
          <label style={{ flex: 1 }}>
            <div style={lblStyle()}>일자 *</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle()}
            />
          </label>
        </div>

        <label>
          <div style={lblStyle()}>금액 *</div>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            style={{ ...inputStyle(), textAlign: 'right' }}
          />
        </label>

        <label>
          <div style={lblStyle()}>거래처</div>
          <input
            type="text"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder="홍길동 / ○○주유소"
            style={inputStyle()}
          />
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ flex: 1 }}>
            <div style={lblStyle()}>계약코드 (자동매칭)</div>
            <input
              type="text"
              value={contractCode}
              onChange={(e) => setContractCode(e.target.value)}
              placeholder="CT00012"
              style={inputStyle()}
            />
          </label>
          <label style={{ flex: 1 }}>
            <div style={lblStyle()}>차량번호</div>
            <input
              type="text"
              value={carNumber}
              onChange={(e) => setCarNumber(e.target.value)}
              placeholder="12가3456"
              style={inputStyle()}
            />
          </label>
        </div>

        <label>
          <div style={lblStyle()}>메모</div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            style={inputStyle()}
          />
        </label>

        <div style={{ color: 'var(--c-text-muted)', fontSize: 11 }}>
          계약코드가 있으면 해당 계약의 미납 청구에 자동 적용됩니다.
        </div>
      </div>
    </EditDialog>
  );
}

function lblStyle(): React.CSSProperties {
  return {
    fontSize: 11,
    color: 'var(--c-text-sub)',
    marginBottom: 2,
    fontWeight: 600,
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid var(--c-border)',
    background: 'var(--c-surface)',
    color: 'var(--c-text)',
    fontFamily: 'inherit',
    fontSize: 13,
    borderRadius: 2,
  };
}
