'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ocrFile } from '@/lib/ocr';
import { parsePenalty, detectPenalty } from '@/lib/parsers/penalty';
import { saveEvent } from '@/lib/firebase/events';
import { useAuth } from '@/lib/auth/context';
import { useSaveStore } from '@/lib/hooks/useSaveStatus';
import { sanitizeCarNumber, formatPhone } from '@/lib/format-input';
import { CarNumberPicker } from '@/components/form/car-number-picker';

type Kind = 'penalty' | 'license' | 'insurance';

interface ExtractedFields {
  car_number?: string;
  date?: string;
  amount?: number;
  name?: string;
  phone?: string;
  raw_text?: string;
}

export default function MobileOcr() {
  const { user } = useAuth();
  const [kind, setKind] = useState<Kind>('penalty');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null);
  const [notes, setNotes] = useState('');

  const onCapture = async (file: File) => {
    setBusy(true);
    setExtracted(null);
    try {
      const reader = new FileReader();
      reader.onload = (e) => setImage(String(e.target?.result ?? ''));
      reader.readAsDataURL(file);

      const { text, lines } = await ocrFile(file);

      if (kind === 'penalty' && detectPenalty(text)) {
        const p = parsePenalty(text, lines);
        setExtracted({
          car_number: sanitizeCarNumber(p.car_number),
          date: p.date,
          amount: p.amount,
          raw_text: text,
        });
        toast.success('과태료 인식 완료');
      } else {
        // 면허증/보험증권 — 간단 추출
        const carMatch = text.match(/(\d{2,3}\s?[가-힣]\s?\d{4})/);
        const dateMatch = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
        const nameMatch = text.match(/성\s*명\s*[:：]?\s*([가-힣]{2,10})/);
        const phoneMatch = text.match(/(010[-\s]?\d{3,4}[-\s]?\d{4})/);
        setExtracted({
          car_number: carMatch ? sanitizeCarNumber(carMatch[1]) : undefined,
          date: dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}` : undefined,
          name: nameMatch?.[1],
          phone: phoneMatch ? formatPhone(phoneMatch[1]) : undefined,
          raw_text: text,
        });
        toast.success('텍스트 추출 완료');
      }
    } catch (err) {
      toast.error(`OCR 실패: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!extracted) return;
    setBusy(true);
    const store = useSaveStore.getState();
    store.begin('저장 중');
    try {
      await saveEvent({
        type: kind === 'penalty' ? 'penalty' : kind === 'license' ? 'license_upload' : 'insurance_upload',
        date: extracted.date ?? new Date().toISOString().slice(0, 10),
        car_number: extracted.car_number,
        amount: extracted.amount,
        title: kind === 'penalty' ? '과태료 고지서' : kind === 'license' ? '면허증 확인' : '보험증권 제출',
        note: notes || undefined,
        handler_uid: user?.uid,
        handler: user?.displayName ?? user?.email ?? undefined,
      });
      store.success('저장 완료');
      toast.success('저장 완료');
      setImage(null);
      setExtracted(null);
      setNotes('');
    } catch (err) {
      store.fail((err as Error).message);
      toast.error(`저장 실패: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="m-title">문서 촬영 · OCR</div>
      <div className="m-subtitle">사진 찍으면 자동 인식 → 저장</div>

      {/* 유형 선택 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {([
          { k: 'penalty', label: '과태료' },
          { k: 'license', label: '면허증' },
          { k: 'insurance', label: '보험증권' },
        ] as const).map(({ k, label }) => (
          <button
            key={k}
            type="button"
            className={`m-btn ${kind === k ? 'is-primary' : ''}`}
            onClick={() => { setKind(k); setImage(null); setExtracted(null); }}
            style={{ flex: 1, padding: 0 }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 촬영 버튼 */}
      <label
        className="m-card"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, padding: 20, marginBottom: 12, cursor: 'pointer',
          background: image ? 'transparent' : 'var(--c-bg-sub)',
          border: image ? '1px solid var(--c-border)' : '1px dashed var(--c-border-strong)',
        }}
      >
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          hidden
          onChange={(e) => e.target.files?.[0] && onCapture(e.target.files[0])}
        />
        {image ? (
          <img src={image} alt="촬영 결과" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 2 }} />
        ) : (
          <>
            <i className="ph ph-camera" style={{ fontSize: 40, color: 'var(--c-text-muted)' }} />
            <div style={{ fontSize: 13, fontWeight: 500 }}>사진 촬영 또는 선택</div>
            <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>카메라가 열리거나 갤러리 선택</div>
          </>
        )}
      </label>

      {busy && (
        <div style={{ textAlign: 'center', padding: 12, color: 'var(--c-primary)' }}>
          <i className="ph ph-spinner spin" /> 인식 중...
        </div>
      )}

      {/* 추출 결과 편집 */}
      {extracted && !busy && (
        <div className="m-card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>인식 결과 — 수정 후 저장</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <label>
              <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 2 }}>차량번호</div>
              <CarNumberPicker
                value={extracted.car_number ?? ''}
                onChange={(v) => setExtracted({ ...extracted, car_number: v })}
              />
            </label>
            <label>
              <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 2 }}>일자</div>
              <input
                className="m-input"
                type="date"
                value={extracted.date ?? ''}
                onChange={(e) => setExtracted({ ...extracted, date: e.target.value })}
              />
            </label>
            {kind === 'penalty' && (
              <label>
                <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 2 }}>금액</div>
                <input
                  className="m-input"
                  type="text"
                  inputMode="numeric"
                  value={extracted.amount ? extracted.amount.toLocaleString() : ''}
                  onChange={(e) => setExtracted({ ...extracted, amount: Number(e.target.value.replace(/,/g, '')) || 0 })}
                />
              </label>
            )}
            {(kind === 'license' || kind === 'insurance') && (
              <label>
                <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 2 }}>성명</div>
                <input
                  className="m-input"
                  value={extracted.name ?? ''}
                  onChange={(e) => setExtracted({ ...extracted, name: e.target.value })}
                />
              </label>
            )}
            <label>
              <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 2 }}>메모 (선택)</div>
              <input
                className="m-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="특이사항"
              />
            </label>
          </div>
          <button
            type="button"
            className="m-btn is-primary"
            onClick={save}
            disabled={busy}
            style={{ width: '100%', marginTop: 12 }}
          >
            <i className={`ph ${busy ? 'ph-spinner spin' : 'ph-check'}`} />
            {busy ? '저장 중' : '저장'}
          </button>
        </div>
      )}
    </div>
  );
}
