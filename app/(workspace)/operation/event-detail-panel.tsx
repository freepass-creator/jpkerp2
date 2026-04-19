'use client';

import Link from 'next/link';
import type { RtdbEvent } from '@/lib/types/rtdb-entities';
import { metaFor } from '@/lib/event-meta';
import { fmt, fmtDate } from '@/lib/utils';

interface Props {
  event: RtdbEvent | null;
}

/** 숨김 필드 — 메타·시스템용 */
const HIDDEN = new Set([
  '_key', 'type', 'status', 'created_at', 'updated_at',
  'handler_uid', 'partner_code', 'customer_phone',
]);

/** 라벨 매핑 — 주요 필드만 한글화 */
const LABELS: Record<string, string> = {
  date: '일자',
  car_number: '차량번호',
  title: '제목',
  amount: '금액',
  vendor: '업체',
  to_location: '도착지',
  from_location: '출발지',
  delivery_location: '출고처',
  return_location: '반납지',
  memo: '메모',
  handler: '담당자',
  contract_code: '계약코드',
  customer_name: '계약자',
  accident_status: '사고상태',
  work_status: '작업상태',
  contact_result: '응대결과',
  contact_channel: '채널',
  collect_result: '미수결과',
  match_status: '매칭상태',
  age_after: '변경후 연령',
  age_before: '변경전 연령',
};

const MONEY_KEYS = new Set(['amount', 'unpaid_amount', 'promise_amount', 'rental_price', 'deposit', 'disposal_amount']);

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? `${value.length}개` : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  if (MONEY_KEYS.has(key)) return fmt(Number(value));
  if (key.includes('date') || key === 'date') return fmtDate(String(value));
  return String(value);
}

export function EventDetailPanel({ event }: Props) {
  if (!event) {
    return (
      <div
        className="flex flex-col items-center justify-center text-text-muted"
        style={{ height: '100%', minHeight: 200, gap: 8 }}
      >
        <i className="ph ph-cursor-click" style={{ fontSize: 32, opacity: 0.4 }} />
        <span style={{ fontSize: 12 }}>좌측 목록에서 이벤트를 클릭하세요</span>
      </div>
    );
  }

  const meta = metaFor(event.type ?? '');
  const entries = Object.entries(event)
    .filter(([k, v]) => !HIDDEN.has(k) && v !== null && v !== undefined && v !== '')
    .sort(([a], [b]) => {
      const order = ['date', 'car_number', 'title', 'amount', 'vendor', 'handler'];
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });

  const photos = (event.photo_urls ?? []) as string[];

  return (
    <div className="overflow-y-auto scrollbar-thin" style={{ height: '100%' }}>
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--c-border)',
          background: 'var(--c-bg-sub)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <i className={`ph ${meta.icon}`} style={{ color: meta.color, fontSize: 18 }} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>{meta.label}</span>
          <span className="text-text-muted" style={{ fontSize: 11, marginLeft: 'auto' }}>
            {event.date ? fmtDate(event.date) : '—'}
          </span>
        </div>
        {event.car_number && (
          <Link
            href={`/asset/${encodeURIComponent(event.car_number)}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: 'var(--c-primary)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <i className="ph ph-car" />
            {event.car_number}
          </Link>
        )}
        {event.title && (
          <div style={{ fontSize: 12, color: 'var(--c-text)', marginTop: 4 }}>{event.title}</div>
        )}
      </div>

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '6px 14px',
          padding: '12px 16px',
          margin: 0,
          fontSize: 12,
        }}
      >
        {entries.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt style={{ color: 'var(--c-text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {LABELS[k] ?? k}
            </dt>
            <dd style={{ margin: 0, color: 'var(--c-text)', wordBreak: 'break-word' }}>
              {formatValue(k, v)}
            </dd>
          </div>
        ))}
      </dl>

      {photos.length > 0 && (
        <div style={{ padding: '8px 16px 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 500, marginBottom: 6 }}>
            첨부 ({photos.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            {photos.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'block', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: 2, border: '1px solid var(--c-border)' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="첨부" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
