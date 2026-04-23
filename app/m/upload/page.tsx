'use client';

import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { ref as rtdbRef, push, set, serverTimestamp } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import { uploadFiles } from '@/lib/firebase/storage';
import { CarNumberPicker } from '@/components/form/car-number-picker';
import { useAuth } from '@/lib/auth/context';
import { useSaveStore } from '@/lib/hooks/useSaveStatus';
import { sanitizeCarNumber } from '@/lib/format-input';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { useRecentCars } from '@/lib/hooks/useRecentCars';
import { isActiveContractStatus } from '@/lib/data/contract-status';
import type { RtdbAsset, RtdbContract } from '@/lib/types/rtdb-entities';

interface PreviewItem {
  file: File;
  url: string;
}

const MAX_FILES = 10;

// 업로드 카테고리 — v1의 4종(상품화·출고·반납·파일) + 문서 2종
const KINDS = [
  { k: 'vehicle_reg',  label: '자동차등록증',   icon: 'ph-car',                 tint: 'var(--c-primary)' },
  { k: 'business_reg', label: '사업자등록증',   icon: 'ph-buildings',           tint: 'var(--c-info)' },
  { k: 'insurance',    label: '보험증권',       icon: 'ph-shield-check',        tint: 'var(--c-success)' },
  { k: 'penalty',      label: '과태료·범칙금', icon: 'ph-warning',             tint: 'var(--c-warn)' },
  { k: 'license',      label: '면허증',         icon: 'ph-identification-card', tint: 'var(--c-text-sub)' },
  { k: 'other',        label: '기타',           icon: 'ph-paperclip',           tint: 'var(--c-text-muted)' },
] as const;
type Kind = typeof KINDS[number]['k'];

export default function MobileUpload() {
  const { user } = useAuth();
  const [carNumber, setCarNumber] = useState('');
  const [kind, setKind] = useState<Kind>('vehicle_reg');
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);

  const recent = useRecentCars();
  const assets = useRtdbCollection<RtdbAsset>('assets');
  const contracts = useRtdbCollection<RtdbContract>('contracts');

  const match = useMemo(() => {
    const cn = sanitizeCarNumber(carNumber);
    if (!cn) return null;
    const asset = assets.data.find((a) => a.car_number === cn && a.status !== 'deleted') ?? null;
    const contract = asset
      ? contracts.data.find(
          (c) => c.car_number === cn
            && (c as { status?: string }).status !== 'deleted'
            && isActiveContractStatus(c.contract_status)
            && c.contractor_name?.trim(),
        ) ?? null
      : null;
    return { cn, asset, contract };
  }, [carNumber, assets.data, contracts.data]);

  const hasCar = !!match?.cn;

  const onPick = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    setItems((prev) => {
      const remaining = MAX_FILES - prev.length;
      if (remaining <= 0) { toast.error(`최대 ${MAX_FILES}장까지`); return prev; }
      const add = arr.slice(0, remaining).map((file) => ({ file, url: URL.createObjectURL(file) }));
      if (arr.length > remaining) toast.warning(`${remaining}장만 추가됨 (최대 ${MAX_FILES})`);
      return [...prev, ...add];
    });
  }, []);

  const removeItem = useCallback((idx: number) => {
    setItems((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const reset = useCallback(() => {
    items.forEach((i) => URL.revokeObjectURL(i.url));
    setItems([]);
    setMemo('');
    setCarNumber('');
    setKind('vehicle_reg');
  }, [items]);

  const submit = useCallback(async () => {
    const cn = sanitizeCarNumber(carNumber);
    if (!cn) { toast.error('차량번호를 입력하세요'); return; }
    if (items.length === 0) { toast.error('사진을 1장 이상 선택하세요'); return; }

    setBusy(true);
    const store = useSaveStore.getState();
    store.begin('업로드 중');
    try {
      const basePath = `mobile_uploads/${cn}`;
      const urls = await uploadFiles(basePath, items.map((i) => i.file));

      const db = getRtdb();
      const ref = push(rtdbRef(db, 'mobile_uploads'));
      await set(ref, {
        car_number: cn,
        partner_code: match?.asset?.partner_code ?? null,
        kind,
        file_urls: urls,
        file_count: urls.length,
        memo: memo || null,
        uploader_uid: user?.uid ?? null,
        uploader_name: user?.displayName ?? user?.email ?? null,
        device: 'mobile',
        status: 'pending',
        created_at: serverTimestamp(),
      });
      recent.push(cn);
      store.success('업로드 완료');
      toast.success(`${urls.length}장 업로드 완료`);
      reset();
    } catch (err) {
      store.fail((err as Error).message);
      toast.error(`업로드 실패: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [carNumber, items, kind, memo, user, match, recent, reset]);

  return (
    <>
      {/* ── 메인 영역 (하단 dock + tabbar 높이만큼 padding) ── */}
      <div style={{ paddingBottom: 80 /* dock: 64 + margin */ }}>
        {/* ① 현재 차량 정보 카드 */}
        <div className="m-card" style={{ padding: 12, marginBottom: 12 }}>
          {hasCar ? (
            match.asset ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
                    {match.asset.car_number}
                  </span>
                  {match.asset.partner_code && (
                    <span className="text-text-sub text-sm">{match.asset.partner_code}</span>
                  )}
                  <span
                    className="text-2xs"
                    style={{
                      marginLeft: 'auto',
                      padding: '2px 8px', borderRadius: 999,
                      background: 'var(--c-success-bg)', color: 'var(--c-success)',
                      fontWeight: 600,
                    }}
                  >
                    <i className="ph ph-check-circle" style={{ marginRight: 2 }} />확인됨
                  </span>
                </div>
                <div className="text-sm text-text-sub" style={{ marginTop: 4 }}>
                  {[match.asset.manufacturer, match.asset.detail_model ?? match.asset.car_model, match.asset.car_year]
                    .filter(Boolean).join(' ') || '(제조사 정보 없음)'}
                </div>
                {match.contract ? (
                  <div className="text-xs text-text-muted" style={{ marginTop: 6 }}>
                    <i className="ph ph-user" style={{ marginRight: 4 }} />
                    {match.contract.contractor_name}
                    {match.contract.contractor_phone && ` · ${match.contract.contractor_phone}`}
                  </div>
                ) : (
                  <div className="text-xs text-warn" style={{ marginTop: 6 }}>
                    <i className="ph ph-info" style={{ marginRight: 4 }} />활성 계약 없음
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-warn">
                <i className="ph ph-warning" style={{ marginRight: 4 }} />
                등록되지 않은 차량 ({match.cn})
                <div className="text-2xs text-text-muted" style={{ marginTop: 4, fontWeight: 400 }}>
                  업로드해두면 관리자가 신규 자산으로 등록합니다.
                </div>
              </div>
            )
          ) : (
            <div className="text-sm text-text-muted" style={{ textAlign: 'center', padding: '16px 0' }}>
              <i className="ph ph-car" style={{ fontSize: 28, display: 'block', marginBottom: 6, opacity: 0.4 }} />
              아래에서 <b>차량번호</b>를 먼저 선택하세요
            </div>
          )}
        </div>

        {/* ② 문서 유형 — 차량 선택 후 노출 */}
        {hasCar && (
          <>
            <div className="m-section-title">문서 유형</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 16 }}>
              {KINDS.map(({ k, label, icon, tint }) => {
                const selected = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    className={`m-btn ${selected ? 'is-primary' : ''}`}
                    onClick={() => setKind(k)}
                    style={{
                      padding: '10px 6px',
                      flexDirection: 'column', gap: 2, height: 'auto',
                      ...(selected ? {} : { color: tint, borderColor: 'var(--c-border)' }),
                    }}
                  >
                    <i className={`ph ${icon}`} style={{ fontSize: 18 }} />
                    <span className="text-xs">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* ③ 사진/파일 */}
            <div className="m-section-title">
              사진·파일
              {items.length > 0 && <span className="text-text-muted"> ({items.length}/{MAX_FILES})</span>}
            </div>

            {items.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
                {items.map((it, idx) => (
                  <div key={idx} style={{ position: 'relative', aspectRatio: '1 / 1', background: 'var(--c-bg-sub)', borderRadius: 2, overflow: 'hidden' }}>
                    {it.file.type.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 4 }}>
                        <i className="ph ph-file-pdf" style={{ fontSize: 28 }} />
                        <div className="text-2xs text-text-muted" style={{ padding: '0 4px', textAlign: 'center', wordBreak: 'break-all' }}>
                          {it.file.name}
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 24, height: 24, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.6)', color: '#fff',
                        border: 'none', cursor: 'pointer', padding: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <i className="ph ph-x" style={{ fontSize: 12 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
              <label className="m-btn" style={{ cursor: 'pointer' }}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => { onPick(e.target.files); e.target.value = ''; }}
                />
                <i className="ph ph-camera" />카메라
              </label>
              <label className="m-btn" style={{ cursor: 'pointer' }}>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  hidden
                  onChange={(e) => { onPick(e.target.files); e.target.value = ''; }}
                />
                <i className="ph ph-images" />갤러리
              </label>
            </div>

            {/* ④ 메모 (선택, 접힘) */}
            <details style={{ marginBottom: 12 }}>
              <summary
                className="text-xs text-text-muted"
                style={{ padding: '10px 12px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 4, cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <i className="ph ph-note" />메모 (선택)
                <i className="ph ph-caret-down" style={{ marginLeft: 'auto' }} />
              </summary>
              <input
                className="m-input"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="특이사항·전달할 내용"
                style={{ marginTop: 6 }}
              />
            </details>

            {/* 저장 */}
            <button
              type="button"
              className="m-btn is-primary"
              onClick={submit}
              disabled={busy || items.length === 0}
              style={{ width: '100%' }}
            >
              <i className={`ph ${busy ? 'ph-spinner spin' : 'ph-cloud-arrow-up'}`} />
              {busy ? '업로드 중' : items.length === 0 ? '사진·파일 먼저 선택' : `${items.length}장 업로드`}
            </button>

            <div className="text-2xs text-text-muted" style={{ marginTop: 12, lineHeight: 1.5, textAlign: 'center' }}>
              임시 저장소에 들어간 뒤 관리자 검토 후 정식 DB로 이동
            </div>
          </>
        )}
      </div>

      {/* ── 하단 dock (tabbar 위) — 차량번호 검색 + 최근 차량 ── */}
      <div className="m-upload-dock">
        <div style={{ marginBottom: recent.list.length > 0 ? 6 : 0 }}>
          <CarNumberPicker
            value={carNumber}
            onChange={setCarNumber}
            placeholder="🔍 차량번호·제조사·모델 검색"
            showCreate={false}
            dropUp
          />
        </div>
        {recent.list.length > 0 && (
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
            {recent.list.slice(0, 8).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCarNumber(c)}
                className="text-xs"
                style={{
                  flexShrink: 0,
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: '1px solid var(--c-border)',
                  background: carNumber === c ? 'var(--c-primary-bg)' : 'var(--c-surface)',
                  color: carNumber === c ? 'var(--c-primary)' : 'var(--c-text-sub)',
                  fontWeight: carNumber === c ? 600 : 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.02em',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
