'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { InputFormShell } from './input-form-shell';
import { Field, TextInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { CarNumberPicker } from '@/components/form/car-number-picker';
import { ocrFile } from '@/lib/ocr';

const DOC_TYPES = [
  '자동차등록증', '보험증권', '면허증', '차량매매계약서',
  '세금계산서', '영수증', '진단서', '정비견적서', '기타',
];

interface KV { key: string; value: string }

/** 라인 텍스트에서 "라벨: 값" 패턴 1차 추출 (휴리스틱) */
function parseLines(lines: string[]): KV[] {
  const out: KV[] = [];
  const seen = new Set<string>();
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // "키 : 값" 또는 "키: 값" 또는 "키  값" (2~+ 공백)
    const m = line.match(/^([^:\t]{1,30})\s*[:\t]\s*(.+)$/) || line.match(/^(\S+(?:\s\S+)?)\s{2,}(.+)$/);
    if (!m) continue;
    const key = m[1].trim();
    const value = m[2].trim();
    if (!key || !value || value.length < 1) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, value });
    if (out.length >= 30) break;
  }
  return out;
}

export function OcrCaptureForm() {
  const [docType, setDocType] = useState('자동차등록증');
  const [carNumber, setCarNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [rawText, setRawText] = useState('');
  const [pairs, setPairs] = useState<KV[]>([]);

  const runOcr = async () => {
    if (!file) return;
    setBusy(true);
    setProgress('OCR 실행 중...');
    try {
      const { text, lines } = await ocrFile(file, {
        onProgress: (p) => setProgress(p.message ?? `${p.stage} ${p.done}/${p.total}`),
      });
      setRawText(text);
      setPairs(parseLines(lines));
      setProgress('');
      toast.success(`OCR 완료 · ${lines.length}줄, ${text.length}자`);
    } catch (err) {
      toast.error(`OCR 실패: ${(err as Error).message}`);
      setProgress('');
    } finally {
      setBusy(false);
    }
  };

  const addPair = () => setPairs((p) => [...p, { key: '', value: '' }]);
  const removePair = (i: number) => setPairs((p) => p.filter((_, idx) => idx !== i));
  const updatePair = (i: number, field: 'key' | 'value', v: string) =>
    setPairs((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: v } : row)));

  return (
    <InputFormShell
      collection="ocr_documents"
      validate={() => (!rawText && pairs.length === 0 ? 'OCR 실행 또는 수기 입력 필요' : null)}
      buildPayload={(d) => {
        const extracted = pairs.reduce<Record<string, string>>((acc, p) => {
          if (p.key.trim()) acc[p.key.trim()] = p.value;
          return acc;
        }, {});
        return {
          doc_type: docType,
          doc_name: d.doc_name || file?.name || undefined,
          car_number: carNumber || undefined,
          raw_text: rawText || undefined,
          extracted,
          note: d.note || undefined,
          file_size: file?.size,
          file_mime: file?.type,
        };
      }}
      onSaved={() => {
        setFile(null);
        setRawText('');
        setPairs([]);
        setCarNumber('');
      }}
    >
      <div className="form-section">
        <div className="form-section-title">
          <i className="ph ph-scan" />문서 업로드 · OCR
          <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 400, marginLeft: 8 }}>
            · 규격 없는 자유 형식. 추출된 내용만 저장.
          </span>
        </div>
        <div className="form-grid">
          <Field label="문서 유형" span={3}>
            <BtnGroup value={docType} onChange={setDocType} options={DOC_TYPES} />
          </Field>
          <Field label="문서명">
            <TextInput name="doc_name" placeholder={file?.name ?? '생략 시 파일명'} />
          </Field>
          <Field label="연결 차량 (선택)" span={2}>
            <CarNumberPicker
              value={carNumber}
              onChange={(v) => setCarNumber(v)}
              placeholder="생략 가능 — 특정 차량 문서면 연결"
            />
          </Field>
          <Field label="파일" span={3}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ flex: 1, fontSize: 12 }}
              />
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={runOcr}
                disabled={!file || busy}
              >
                <i className={`ph ${busy ? 'ph-spinner spin' : 'ph-magic-wand'}`} />
                {busy ? progress || 'OCR...' : 'OCR 실행'}
              </button>
            </div>
          </Field>
        </div>
      </div>

      {(rawText || pairs.length > 0) && (
        <div className="form-section">
          <div className="form-section-title">
            <i className="ph ph-list-bullets" />추출 결과 ({pairs.length}쌍)
            <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 400, marginLeft: 8 }}>
              · 자동 파싱 결과. 자유롭게 편집·추가·삭제 가능
            </span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={addPair} style={{ marginLeft: 'auto' }}>
              <i className="ph ph-plus" />항목 추가
            </button>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {pairs.map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 32px', gap: 6 }}>
                <input
                  type="text"
                  className="ctrl"
                  value={p.key}
                  onChange={(e) => updatePair(i, 'key', e.target.value)}
                  placeholder="항목명"
                  style={{ fontSize: 12 }}
                />
                <input
                  type="text"
                  className="ctrl"
                  value={p.value}
                  onChange={(e) => updatePair(i, 'value', e.target.value)}
                  placeholder="값"
                  style={{ fontSize: 12 }}
                />
                <button
                  type="button"
                  onClick={() => removePair(i)}
                  className="btn btn-sm btn-ghost"
                  title="삭제"
                  style={{ color: 'var(--c-danger)' }}
                >
                  <i className="ph ph-x" />
                </button>
              </div>
            ))}
            {pairs.length === 0 && (
              <div className="text-text-muted" style={{ fontSize: 11, padding: 8 }}>
                자동 파싱된 항목 없음. "항목 추가"로 수기 입력 가능.
              </div>
            )}
          </div>
        </div>
      )}

      {rawText && (
        <div className="form-section">
          <div className="form-section-title">
            <i className="ph ph-file-text" />원본 텍스트 (참고용)
          </div>
          <TextArea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={6}
            style={{ fontFamily: 'monospace', fontSize: 11 }}
          />
        </div>
      )}

      <div className="form-section">
        <div className="form-section-title"><i className="ph ph-note" />메모</div>
        <div className="form-grid">
          <Field label="메모" span={3}>
            <TextArea name="note" rows={2} placeholder="문서 맥락·처리 결과 등" />
          </Field>
        </div>
      </div>
    </InputFormShell>
  );
}
