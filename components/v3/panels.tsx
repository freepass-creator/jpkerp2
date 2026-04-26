'use client';

/**
 * v3 공용 패널/상태 컴포넌트
 *
 * 여러 page.tsx 가 동일한 alert 패널·loading·error·placeholder JSX 를
 * 인라인으로 반복하던 것을 컴포넌트화. 디자인은 globals.css 의
 * .v3-* 클래스 그대로 유지 (시각적 변화 없음).
 */

import type { AlertItem, AlertSeverity } from '@/lib/types/v3-ui';
import type { CSSProperties, ReactNode } from 'react';

/* ── helpers ────────────────────────────────────────────────── */

function severityCls(sev: AlertSeverity): string {
  if (sev === 'danger') return 'is-danger';
  if (sev === 'info') return 'is-info';
  return '';
}

/* ── AlertsPanel ─────────────────────────────────────────────
   isClear=true → 녹색 헤더 + 그리드 숨김 (.v3-alerts.is-clear)
   alerts 비어있으면 자동 isClear */
export function AlertsPanel({
  alerts,
  clearTitle = '미결 없음',
  pendingTitle,
  pendingCountLabel,
  emptyExtra,
  onAlertAction,
}: {
  alerts: readonly AlertItem[];
  clearTitle?: string;
  pendingTitle?: string;
  /** 0건 표시: '· 0건' default */
  emptyExtra?: ReactNode;
  /** 미결 헤더 카운트 표시 — 미지정시 alerts.count 합계 */
  pendingCountLabel?: string;
  onAlertAction?: (alert: AlertItem) => void;
}) {
  const isClear = alerts.length === 0;
  const total = alerts.reduce((sum, a) => sum + a.count, 0);
  return (
    <div className={`v3-alerts ${isClear ? 'is-clear' : ''}`}>
      <div className="v3-alerts-head">
        <span className="dot" />
        <span className="title">{isClear ? clearTitle : (pendingTitle ?? '미결')}</span>
        <span className="count">
          {isClear ? (emptyExtra ?? '· 0건') : (pendingCountLabel ?? `· ${total}건`)}
        </span>
      </div>
      {!isClear && (
        <div className="v3-alerts-grid">
          {alerts.map((a) => (
            <AlertCard
              key={a.key}
              alert={a}
              onClick={onAlertAction ? () => onAlertAction(a) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── AlertCard (단독 사용 가능) ─────────────────────────────── */
export function AlertCard({
  alert,
  onClick,
}: {
  alert: AlertItem;
  onClick?: () => void;
}) {
  return (
    <div className={`v3-alert-card ${severityCls(alert.severity)}`}>
      <i className={`ph ${alert.icon} ico`} />
      <div className="body">
        <div className="head">{alert.head}</div>
        <div className="desc">{alert.desc}</div>
      </div>
      <button type="button" className="alert-btn" onClick={onClick}>
        {alert.actionLabel}
      </button>
    </div>
  );
}

/* ── PanelHeader (.v3-alerts-head 단독 사용) ─────────────────
   ico + title + count 패턴이 alert grid 없이 사용되는 경우에 사용 */
export function PanelHeader({
  icon,
  title,
  count,
  trailing,
}: {
  icon?: string;
  title: ReactNode;
  count?: ReactNode;
  /** 우측 추가 영역 (필터 등) */
  trailing?: ReactNode;
}) {
  return (
    <div className="v3-alerts-head">
      {icon ? <i className={`ph ${icon} ico`} /> : <span className="dot" />}
      <span className="title">{title}</span>
      {count ? <span className="count">{count}</span> : null}
      {trailing}
    </div>
  );
}

/* ── Loading / Error / Empty 박스 (table-wrap 안) ────────── */

export function LoadingBox({
  label = '데이터 로드 중...',
}: {
  label?: string;
}) {
  return (
    <div className="v3-loading">
      <i className="ph ph-spinner spin" /> {label}
    </div>
  );
}

export function ErrorBox({
  error,
  head = '데이터 로드 실패',
}: {
  error: Error | { message?: string } | string | null;
  head?: string;
}) {
  const msg =
    typeof error === 'string'
      ? error
      : ((error as { message?: string })?.message ?? '알 수 없는 오류');
  return (
    <div className="v3-error-box">
      <div className="head">{head}</div>
      <div className="msg">{msg}</div>
    </div>
  );
}

export function EmptyBox({
  label = '데이터가 없습니다.',
}: {
  label?: string;
}) {
  return <div className="v3-loading">{label}</div>;
}

/* ── PlaceholderBlock (.v3-placeholder + 큰 아이콘) ─────── */
export function PlaceholderBlock({
  icon = 'ph-hourglass-medium',
  title,
  desc,
}: {
  icon?: string;
  title: string;
  desc?: ReactNode;
}) {
  return (
    <div className="v3-placeholder">
      <i className={`ph ${icon}`} />
      <div className="title">{title}</div>
      {desc ? <div className="desc">{desc}</div> : null}
    </div>
  );
}

/* ── TableFoot (.v3-table-foot) ───────────────────────────── */
export function TableFoot({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="v3-table-foot">
      <div>{children}</div>
      {trailing ? <div className="v3-stat-mut">{trailing}</div> : null}
    </div>
  );
}

/* ── Stat dots — table-foot 안에서 자주 쓰임 ────────────── */
export function StatDot({
  variant,
}: {
  variant: 'active' | 'idle' | 'repair' | 'sale';
}) {
  return <span className={`stat-dot ${variant}`} />;
}

export function StatSep() {
  return <span className="sep">│</span>;
}

/* ── 인라인 표 셀 스타일 (기존 cellTh/cellTd 통합) ────── */

export function cellTh(width?: number): CSSProperties {
  return {
    padding: '6px 8px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--c-text-sub)',
    textAlign: 'center',
    width,
  };
}

export function cellTd(): CSSProperties {
  return {
    padding: '6px 8px',
    textAlign: 'center',
    color: 'var(--c-text)',
  };
}
