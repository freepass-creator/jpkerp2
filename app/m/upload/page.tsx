'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ref as rtdbRef, push, set, serverTimestamp } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import { uploadFiles } from '@/lib/firebase/storage';
import { CarNumberPicker } from '@/components/form/car-number-picker';
import { useAuth } from '@/lib/auth/context';
import { useSaveStore } from '@/lib/hooks/useSaveStatus';
import { sanitizeCarNumber } from '@/lib/format-input';

interface PreviewItem {
  file: File;
  url: string;   // object URL for preview
}

const MAX_FILES = 10;

// 업로드 카테고리 (정식 DB로 이동 시 분기점)
const KINDS = [
  { k: 'vehicle_reg', label: '자동차등록증', icon: 'ph-car', hint: '차량 자산 자동 등록' },
  { k: 'business_reg', label: '사업자등록증', icon: 'ph-buildings', hint: '회원사 자동 등록' },
  { k: 'insurance', label: '보험증권', icon: 'ph-shield-check', hint: '보험 자동 등록' },
  { k: 'penalty', label: '과태료·범칙금', icon: 'ph-warning', hint: '이벤트 자동 등록' },
  { k: 'license', label: '면허증', icon: 'ph-identification-card', hint: '계약자 정보' },
  { k: 'other', label: '기타', icon: 'ph-paperclip', hint: '직접 분류' },
] as const;
type Kind = typeof KINDS[number]['k'];

export default function MobileUpload() {
  const { user } = useAuth();
  const [carNumber, setCarNumber] = useState('');
  const [kind, setKind] = useState<Kind>('vehicle_reg');
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);

  const onPick = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    setItems((prev) => {
      const remaining = MAX_FILES - prev.length;
      if (remaining <= 0) {
        toast.error(`최대 ${MAX_FILES}장까지`);
        return prev;
      }
      const add = arr.slice(0, remaining).map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }));
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
      // Storage 경로: mobile_uploads/{car_number}/{timestamp}_{filename}
      const basePath = `mobile_uploads/${cn}`;
      const urls = await uploadFiles(basePath, items.map((i) => i.file));

      // RTDB 기록 — 정식 DB에 이동되기 전 inbox
      const db = getRtdb();
      const ref = push(rtdbRef(db, 'mobile_uploads'));
      await set(ref, {
        car_number: cn,
        kind,
        file_urls: urls,
        file_count: urls.length,
        memo: memo || null,
        uploader_uid: user?.uid ?? null,
        uploader_name: user?.displayName ?? user?.email ?? null,
        device: 'mobile',
        status: 'pending',      // pending → imported / rejected
        created_at: serverTimestamp(),
      });
      store.success('업로드 완료');
      toast.success(`${urls.length}장 업로드 완료`);
      reset();
    } catch (err) {
      store.fail((err as Error).message);
      toast.error(`업로드 실패: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [carNumber, items, kind, memo, user, reset]);

  return (
    <div>
      <div className="m-title">업로드</div>
      <div className="m-subtitle">차량번호 + 문서 사진 · 별도 저장 후 검토 반영</div>

      {/* 차량번호 */}
      <label className="text-xs text-text-muted" style={{ display: 'block', marginBottom: 4 }}>차량번호</label>
      <CarNumberPicker
        value={carNumber}
        onChange={setCarNumber}
        placeholder="예: 98고1234"
        autoFocus
      />

      {/* 유형 선택 */}
      <div className="m-section-title">문서 유형</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 12 }}>
        {KINDS.map(({ k, label, icon }) => (
          <button
            key={k}
            type="button"
            className={`m-btn ${kind === k ? 'is-primary' : ''}`}
            onClick={() => setKind(k)}
            style={{ padding: '10px 6px', flexDirection: 'column', gap: 2, height: 'auto' }}
          >
            <i className={`ph ${icon}`} style={{ fontSize: 18 }} />
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>

      {/* 사진 영역 */}
      <div className="m-section-title">사진 {items.length > 0 && <span className="text-text-muted">({items.length}/{MAX_FILES})</span>}</div>

      {items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
          {items.map((it, idx) => (
            <div key={idx} style={{ position: 'relative', aspectRatio: '1 / 1', background: 'var(--c-bg-sub)', borderRadius: 2, overflow: 'hidden' }}>
              {it.file.type.startsWith('image/') ? (
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        <label className="m-btn" style={{ cursor: 'pointer' }}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => { onPick(e.target.files); e.target.value = ''; }}
          />
          <i className="ph ph-camera" />
          카메라
        </label>
        <label className="m-btn" style={{ cursor: 'pointer' }}>
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            hidden
            onChange={(e) => { onPick(e.target.files); e.target.value = ''; }}
          />
          <i className="ph ph-images" />
          갤러리
        </label>
      </div>

      {/* 메모 */}
      <label className="text-xs text-text-muted" style={{ display: 'block', marginBottom: 4 }}>메모 (선택)</label>
      <input
        className="m-input"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="특이사항 · 전달할 내용"
        style={{ marginBottom: 16 }}
      />

      {/* 저장 */}
      <button
        type="button"
        className="m-btn is-primary"
        onClick={submit}
        disabled={busy || items.length === 0 || !carNumber}
        style={{ width: '100%' }}
      >
        <i className={`ph ${busy ? 'ph-spinner spin' : 'ph-cloud-arrow-up'}`} />
        {busy ? '업로드 중' : `업로드 (${items.length}장)`}
      </button>

      <div className="text-2xs text-text-muted" style={{ marginTop: 12, lineHeight: 1.5 }}>
        업로드된 파일은 <b>mobile_uploads</b> 임시 저장소에 들어간 뒤
        관리자가 검토해 정식 데이터베이스(자산·이벤트·보험 등)로 이동됩니다.
      </div>
    </div>
  );
}
