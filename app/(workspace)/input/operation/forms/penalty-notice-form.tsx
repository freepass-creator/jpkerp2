'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { ocrFile } from '@/lib/ocr';
import { parsePenalty } from '@/lib/parsers/penalty';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { usePenaltyStore } from '../penalty-notice-store';
import type { RtdbAsset, RtdbContract } from '@/lib/types/rtdb-entities';

/**
 * 과태료작업 — Panel2에는 업로드 UI만, 매칭 결과 Grid는 Panel3(이력관리 패널 자리)에 표시.
 */
export function PenaltyNoticeForm() {
  const assets = useRtdbCollection<RtdbAsset>('assets');
  const contracts = useRtdbCollection<RtdbContract>('contracts');
  const { add, setBusy, busy, items } = usePenaltyStore();

  const fileToDataUrl = (f: File) =>
    new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(f);
    });

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const id = `p${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        toast.info(`OCR 중: ${file.name}`);
        try {
          const { text, lines } = await ocrFile(file);
          const parsed = parsePenalty(text, lines);
          const dataUrl = await fileToDataUrl(file);
          const asset = assets.data.find((a) => a.car_number === parsed.car_number) ?? null;
          const contract = contracts.data.find(
            (c) =>
              c.car_number === parsed.car_number &&
              c.status !== 'deleted' &&
              c.contractor_name?.trim(),
          ) ?? null;
          const ok = add({
            ...parsed,
            id,
            fileName: file.name,
            fileDataUrl: dataUrl,
            fileSize: file.size,
            _asset: asset,
            _contract: contract,
            _contractor: contract?.contractor_name ?? '',
          });
          if (!ok) toast.warning(`중복: ${parsed.notice_no}`);
          else toast.success(`인식: ${parsed.car_number || '차량번호 미확인'} · ${parsed.amount.toLocaleString()}원`);
        } catch (err) {
          toast.error(`OCR 실패: ${file.name} — ${(err as Error).message}`);
        }
      }
    } finally {
      setBusy(false);
    }
  }, [assets.data, contracts.data, add, setBusy]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('is-over');
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  };

  const totalAmount = items.reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      <div className="p-5 overflow-y-auto scrollbar-thin" style={{ flex: 1 }}>
        <div className="form-section">
          <div className="form-section-title">
            <i className="ph ph-receipt" />과태료 · 통행료 고지서 OCR
            <span className="text-text-muted" style={{ marginLeft: 8, fontSize: 10, fontWeight: 500 }}>
              고지서 업로드 → 우측 매칭 결과에서 처리완료
            </span>
          </div>

          <label
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('is-over'); }}
            onDragLeave={(e) => e.currentTarget.classList.remove('is-over')}
            onDrop={onDrop}
            className="jpk-uploader-drop"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            <input
              type="file"
              multiple
              accept="application/pdf,image/*"
              hidden
              onChange={(e) => e.target.files && processFiles(e.target.files)}
            />
            <i className="ph ph-file-arrow-up" style={{ fontSize: 24 }} />
            <div style={{ fontSize: 12, fontWeight: 600 }}>고지서 파일 업로드 (드래그 또는 클릭)</div>
            <div style={{ fontSize: 10 }} className="text-text-muted">PDF · PNG · JPG · HEIC</div>
            {busy && <div style={{ fontSize: 10, color: 'var(--c-primary)' }}>OCR 진행 중...</div>}
          </label>
        </div>

        {items.length > 0 && (
          <div className="form-section">
            <div className="form-section-title">
              <i className="ph ph-info" />현황
            </div>
            <div
              style={{
                padding: 12,
                background: 'var(--c-bg-sub)',
                border: '1px solid var(--c-border)',
                borderRadius: 2,
                fontSize: 12,
                color: 'var(--c-text-sub)',
              }}
            >
              작업 대기 <b style={{ color: 'var(--c-text)' }}>{items.length}건</b> · 합계{' '}
              <b style={{ color: 'var(--c-text)' }}>{totalAmount.toLocaleString()}원</b>
              <br />
              오른쪽 <b>매칭 결과</b> 패널에서 개별 처리 또는 일괄 완료 가능
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
