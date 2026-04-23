'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ref, update, serverTimestamp } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { fmtDate } from '@/lib/utils';
import { ToolActions } from '../tool-actions-context';

// 업로드 유형 라벨·아이콘 — /m/upload 의 KINDS 와 1:1 매핑
const KIND_META: Record<string, { label: string; icon: string; color: string }> = {
  vehicle_reg:  { label: '자동차등록증', icon: 'ph-car',                 color: 'var(--c-primary)' },
  business_reg: { label: '사업자등록증', icon: 'ph-buildings',           color: 'var(--c-info)' },
  insurance:    { label: '보험증권',     icon: 'ph-shield-check',        color: 'var(--c-success)' },
  penalty:      { label: '과태료',       icon: 'ph-warning',             color: 'var(--c-warn)' },
  license:      { label: '면허증',       icon: 'ph-identification-card', color: 'var(--c-text-sub)' },
  other:        { label: '기타',         icon: 'ph-paperclip',           color: 'var(--c-text-muted)' },
};

interface MobileUpload extends Record<string, unknown> {
  _key?: string;
  car_number?: string;
  kind?: string;
  file_urls?: string[];
  file_count?: number;
  memo?: string;
  uploader_name?: string;
  uploader_uid?: string;
  status?: 'pending' | 'imported' | 'rejected' | 'deleted';
  created_at?: number;
}

type Filter = 'pending' | 'imported' | 'rejected' | 'all';

export function MobileInboxTool() {
  const uploads = useRtdbCollection<MobileUpload>('mobile_uploads');
  const [filter, setFilter] = useState<Filter>('pending');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const rows = useMemo(() => {
    return uploads.data
      .filter((u) => u.status !== 'deleted')
      .filter((u) => filter === 'all' ? true : (u.status ?? 'pending') === filter)
      .sort((a, b) => Number(b.created_at ?? 0) - Number(a.created_at ?? 0));
  }, [uploads.data, filter]);

  const setStatus = async (_key: string, status: 'imported' | 'rejected' | 'pending') => {
    setBusyKey(_key);
    try {
      await update(ref(getRtdb(), `mobile_uploads/${_key}`), {
        status,
        reviewed_at: serverTimestamp(),
      });
      toast.success(status === 'imported' ? '반영 완료' : status === 'rejected' ? '반려 완료' : '대기로 되돌림');
    } catch (err) {
      toast.error(`상태 변경 실패: ${(err as Error).message}`);
    } finally {
      setBusyKey(null);
    }
  };

  const counts = useMemo(() => {
    const c = { pending: 0, imported: 0, rejected: 0, all: 0 };
    for (const u of uploads.data) {
      if (u.status === 'deleted') continue;
      c.all++;
      const s = (u.status ?? 'pending') as 'pending' | 'imported' | 'rejected';
      if (s in c) c[s]++;
    }
    return c;
  }, [uploads.data]);

  return (
    <>
      <ToolActions>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['pending', 'imported', 'rejected', 'all'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`btn ${filter === f ? 'is-primary' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'pending' ? '대기' : f === 'imported' ? '반영' : f === 'rejected' ? '반려' : '전체'}
              <span className="text-text-muted" style={{ marginLeft: 4 }}>({counts[f]})</span>
            </button>
          ))}
        </div>
      </ToolActions>

      <div style={{ padding: 14, overflowY: 'auto', height: '100%' }}>
        {rows.length === 0 ? (
          <div className="text-text-muted text-xs" style={{ textAlign: 'center', padding: 40 }}>
            <i className="ph ph-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
            {filter === 'pending' ? '대기 중인 업로드 없음' : `${filter} 상태 항목 없음`}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map((u) => {
              const meta = KIND_META[u.kind ?? 'other'] ?? KIND_META.other;
              const isBusy = busyKey === u._key;
              const status = u.status ?? 'pending';
              return (
                <div
                  key={u._key}
                  style={{
                    border: '1px solid var(--c-border)',
                    borderRadius: 2,
                    padding: 10,
                    background: status === 'imported' ? 'var(--c-success-bg)'
                              : status === 'rejected' ? 'var(--c-bg-sub)'
                              : 'var(--c-surface)',
                    opacity: status === 'rejected' ? 0.6 : 1,
                  }}
                >
                  {/* 헤더: 유형 + 차량번호 + 날짜 + 상태 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <i className={`ph ${meta.icon}`} style={{ fontSize: 20, color: meta.color }} />
                    <div style={{ flex: 1 }}>
                      <div className="text-base" style={{ fontWeight: 600 }}>
                        {u.car_number ?? '(차량번호 없음)'} <span className="text-text-sub">· {meta.label}</span>
                      </div>
                      <div className="text-xs text-text-muted" style={{ marginTop: 2 }}>
                        {u.uploader_name ?? '(익명)'} · {u.created_at ? fmtDate(new Date(Number(u.created_at)).toISOString().slice(0, 10)) : '-'}
                      </div>
                    </div>
                    <span
                      className="text-2xs"
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: status === 'pending' ? 'var(--c-warn-bg)'
                                  : status === 'imported' ? 'var(--c-success-bg)'
                                  : 'var(--c-bg-sub)',
                        color: status === 'pending' ? 'var(--c-warn)'
                             : status === 'imported' ? 'var(--c-success)'
                             : 'var(--c-text-sub)',
                        fontWeight: 600,
                      }}
                    >
                      {status === 'pending' ? '대기' : status === 'imported' ? '반영됨' : '반려'}
                    </span>
                  </div>

                  {/* 썸네일 */}
                  {u.file_urls && u.file_urls.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 4, marginBottom: 8 }}>
                      {u.file_urls.map((url, idx) => {
                        const isPdf = /\.pdf($|\?)/i.test(url);
                        return (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              aspectRatio: '1 / 1',
                              background: 'var(--c-bg-sub)',
                              borderRadius: 2,
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isPdf ? (
                              <i className="ph ph-file-pdf" style={{ fontSize: 24, color: 'var(--c-danger)' }} />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url} alt={`file-${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {/* 메모 */}
                  {u.memo && (
                    <div className="text-xs text-text-sub" style={{ marginBottom: 8, padding: '6px 8px', background: 'var(--c-bg-sub)', borderRadius: 2 }}>
                      {u.memo}
                    </div>
                  )}

                  {/* 액션 */}
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    {status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setStatus(u._key!, 'rejected')}
                          disabled={isBusy}
                        >
                          <i className="ph ph-x" /> 반려
                        </button>
                        <button
                          type="button"
                          className="btn is-primary"
                          onClick={() => setStatus(u._key!, 'imported')}
                          disabled={isBusy}
                        >
                          <i className={`ph ${isBusy ? 'ph-spinner spin' : 'ph-check'}`} /> 반영 완료
                        </button>
                      </>
                    )}
                    {status !== 'pending' && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setStatus(u._key!, 'pending')}
                        disabled={isBusy}
                      >
                        <i className="ph ph-arrow-counter-clockwise" /> 대기로 되돌림
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-2xs text-text-muted" style={{ marginTop: 16, lineHeight: 1.5 }}>
          <i className="ph ph-info" style={{ marginRight: 4 }} />
          v1: 사진·PDF 보기만 지원. 반영 처리 후 데스크톱 일괄 불러오기/개별 입력으로 수동 생성 필요.
          자동 OCR 반영은 추후 추가 예정.
        </div>
      </div>
    </>
  );
}
