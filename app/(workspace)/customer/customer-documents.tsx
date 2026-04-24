'use client';

import { useMemo } from 'react';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { fmtDate } from '@/lib/utils';
import type { RtdbContract, RtdbEvent } from '@/lib/types/rtdb-entities';

interface DocRow {
  url: string;
  label: string;
  source: string;
  sourceTone: 'primary' | 'success' | 'warn' | 'neutral';
  date: string;
}

interface Props {
  customer: { _key?: string; customer_id?: string; name?: string; phone?: string } | null;
}

/**
 * 고객 제출 서류 모아보기 — 계약서/보험증권/운영이력 첨부 통합.
 * 계약자명 + 연락처로 매칭 (customer_code 없는 레거시 데이터 대응).
 */
export function CustomerDocuments({ customer }: Props) {
  const contracts = useRtdbCollection<RtdbContract>('contracts');
  const events = useRtdbCollection<RtdbEvent>('events');

  const docs: DocRow[] = useMemo(() => {
    if (!customer) return [];
    const name = customer.name?.trim();
    const phone = customer.phone?.trim();
    const cid = customer._key ?? customer.customer_id;
    const out: DocRow[] = [];

    const matchesCustomer = (rec: { contractor_name?: string; customer_name?: string; customer_code?: string; customer_phone?: string; contractor_phone?: string }) => {
      if (cid && rec.customer_code === cid) return true;
      if (name && (rec.contractor_name === name || rec.customer_name === name)) {
        if (!phone) return true;
        const p = rec.contractor_phone ?? rec.customer_phone;
        return !p || p === phone;
      }
      return false;
    };

    for (const c of contracts.data) {
      if (c.status === 'deleted') continue;
      if (!matchesCustomer(c)) continue;
      const date = c.start_date ?? '';
      for (const url of (c.contract_doc_urls as string[] | undefined) ?? []) {
        out.push({ url, label: `계약서 · ${c.contract_code ?? ''}`, source: '계약서', sourceTone: 'primary', date });
      }
      for (const url of (c.insurance_doc_urls as string[] | undefined) ?? []) {
        out.push({ url, label: `보험증권 · ${c.contract_code ?? ''}`, source: '보험', sourceTone: 'success', date });
      }
    }

    const SOURCE_MAP: Record<string, { label: string; tone: DocRow['sourceTone'] }> = {
      delivery: { label: '출고', tone: 'success' },
      return: { label: '반납', tone: 'neutral' },
      product_register: { label: '상품등록', tone: 'primary' },
      accident: { label: '사고', tone: 'warn' },
      insurance: { label: '보험', tone: 'success' },
      penalty_notice: { label: '과태료', tone: 'warn' },
      collect: { label: '독촉', tone: 'warn' },
      contact: { label: '상담', tone: 'neutral' },
    };

    for (const e of events.data) {
      if (e.status === 'deleted') continue;
      if (!matchesCustomer(e)) continue;
      const urls = (e.photo_urls as string[] | undefined) ?? [];
      if (urls.length === 0) continue;
      const meta = SOURCE_MAP[e.type ?? ''] ?? { label: e.type ?? '기타', tone: 'neutral' as const };
      for (const url of urls) {
        out.push({ url, label: e.title ?? meta.label, source: meta.label, sourceTone: meta.tone, date: e.date ?? '' });
      }
    }

    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [contracts.data, events.data, customer]);

  if (!customer) return null;
  const isImage = (url: string) => /\.(jpe?g|png|webp|gif|heic)(?:\?|$)/i.test(url);

  return (
    <div className="form-section" style={{ marginTop: 8 }}>
      <div className="form-section-title">
        <i className="ph ph-files" />제출 서류
        <span className="text-text-muted text-2xs" style={{ marginLeft: 'auto', fontWeight: 500 }}>
          {docs.length}건
        </span>
      </div>
      {docs.length === 0 ? (
        <EmptyState icon="ph-files" title="서류 없음" size="sm" />
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {docs.map((d, i) => (
            <a
              key={`${d.url}-${i}`}
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col gap-1 text-xs"
              style={{ textDecoration: 'none', color: 'inherit' }}
              title={d.label}
            >
              <div
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 2,
                  border: '1px solid var(--c-border)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--c-bg-sub)',
                }}
              >
                {isImage(d.url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.url} alt={d.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <i className="ph ph-file-pdf text-[32px] text-text-muted" />
                )}
              </div>
              <div className="flex items-center gap-1">
                <StatusBadge tone={d.sourceTone}>{d.source}</StatusBadge>
                {d.date && <span className="text-text-muted text-2xs">{fmtDate(d.date)}</span>}
              </div>
              <div className="truncate text-text-sub">{d.label}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
