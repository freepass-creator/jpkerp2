'use client';

/**
 * CsvUploadDialog — CSV/구글시트 일괄 업로드 모달 (V1 패턴 이식).
 *
 * 흐름:
 *   1. 구글 시트 URL 또는 CSV 파일 → 텍스트 로드
 *   2. parseCsv → 헤더 + 행
 *   3. detectType(헤더) → DETECTOR 자동 선택 (또는 수동 변경)
 *   4. parse → 정규화된 객체 5행 미리보기
 *   5. validate → 행별 오류 표시
 *   6. 저장 — Storage 업로드 이력 기록 + 각 detector.save 호출
 *
 * 중복 업로드 차단:
 *   fileFingerprint(filename, rowCount, firstRow) 검사 → 이미 있으면 차단.
 */

import { EditDialog } from '@/components/shared/edit-dialog';
import { useAuth } from '@/lib/auth/context';
import { parseCsv } from '@/lib/csv';
import {
  fileFingerprint,
  findUploadByFingerprint,
  saveUpload,
  updateUpload,
} from '@/lib/firebase/uploads';
import { fetchGoogleSheet } from '@/lib/sheet-import';
import { DETECTORS, type Detector, detectType } from '@/lib/upload-detectors';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Mode = 'sheet' | 'file';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 업로드 완료 후 호출 — 콘텐츠 반영 */
  onUploaded?: (result: { detector: string; ok: number; fail: number }) => void;
}

export function CsvUploadDialog({ open, onClose, onUploaded }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('sheet');
  const [sheetUrl, setSheetUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [text, setText] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [detector, setDetector] = useState<Detector | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<'input' | 'preview' | 'done'>('input');
  const [result, setResult] = useState<{
    ok: number;
    fail: number;
    errors: { row: number; message: string }[];
  } | null>(null);

  const reset = () => {
    setMode('sheet');
    setSheetUrl('');
    setFilename('');
    setText('');
    setRows([]);
    setDetector(null);
    setStage('input');
    setResult(null);
  };

  // 모달 닫힐 때 상태 초기화
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset은 안정적 — open 변경 시점만 추적
  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);

  /* ── 텍스트 로드 후 자동 분류 ── */
  const ingest = (csvText: string, name: string) => {
    setFilename(name);
    setText(csvText);
    const parsed = parseCsv(csvText);
    if (parsed.length < 2) {
      toast.error('데이터 행이 없습니다');
      return;
    }
    setRows(parsed);
    const det = detectType(parsed[0]);
    setDetector(det.detector);
    if (!det.detector) {
      toast.warning('유형 자동 인식 실패 — 수동 선택해주세요');
    } else {
      toast.success(`${det.detector.label} 자동 인식 (${parsed.length - 1}행)`);
    }
    setStage('preview');
  };

  const onSheetLoad = async () => {
    if (!sheetUrl.trim()) {
      toast.error('시트 URL을 입력하세요');
      return;
    }
    setBusy(true);
    try {
      const t = await fetchGoogleSheet(sheetUrl.trim());
      ingest(t, sheetUrl.split('?')[0].split('#')[0].split('/').pop() ?? 'sheet.csv');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (f: File) => {
    setBusy(true);
    try {
      const t = await f.text();
      ingest(t, f.name);
    } catch (e) {
      toast.error(`파일 읽기 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  /* ── 업로드 실행 ── */
  const onUpload = async () => {
    if (!detector) {
      toast.error('유형이 선택되지 않았습니다');
      return;
    }
    if (!rows.length) {
      toast.error('데이터가 없습니다');
      return;
    }

    // fingerprint 중복 검사
    const fp = fileFingerprint(filename, dataRows.length, headers.join('|'));
    const dup = await findUploadByFingerprint(fp);
    if (dup) {
      const ago = dup.uploaded_at ? new Date(dup.uploaded_at).toLocaleString('ko-KR') : '';
      toast.warning(
        `이미 업로드된 파일입니다 (${ago}). 새 데이터라면 시트/파일명을 바꿔서 다시 시도해주세요.`,
      );
      return;
    }

    setBusy(true);
    try {
      // 이력 기록 (pending)
      const uploadKey = await saveUpload({
        filename,
        file_type: mode === 'sheet' ? 'sheet' : 'csv',
        detected_type: detector.key,
        detected_label: detector.label,
        row_count: dataRows.length,
        fingerprint: fp,
        handler_uid: user?.uid,
        handler: user?.displayName ?? user?.email ?? undefined,
      });

      // parse + validate + save
      const parsed = detector.parse(dataRows, headers);
      const r = { ok: 0, fail: 0, errors: [] as { row: number; message: string }[] };

      for (let i = 0; i < parsed.length; i++) {
        const row = parsed[i];
        const errs = detector.validate?.(row) ?? [];
        if (errs.length) {
          r.errors.push({ row: i + 2, message: errs.join(', ') });
          r.fail++;
          continue;
        }
        try {
          await detector.save(row, {
            user: user
              ? { uid: user.uid, email: user.email, displayName: user.displayName }
              : undefined,
          });
          r.ok++;
        } catch (e) {
          r.errors.push({ row: i + 2, message: (e as Error).message });
          r.fail++;
        }
      }

      await updateUpload(uploadKey, {
        status: r.fail === 0 ? 'processed' : 'partial',
        processed_at: Date.now(),
        results: { ok: r.ok, skip: 0, fail: r.fail },
      });

      setResult(r);
      setStage('done');
      if (r.ok > 0) toast.success(`${detector.label} ${r.ok}건 업로드 완료`);
      onUploaded?.({ detector: detector.key, ok: r.ok, fail: r.fail });
    } catch (e) {
      toast.error(`업로드 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const onSave = stage === 'done' ? onClose : onUpload;
  const primaryLabel = stage === 'done' ? '닫기' : busy ? '처리 중...' : '업로드 시작';
  const subtitle =
    stage === 'preview' && detector
      ? `${detector.label} · ${dataRows.length}행`
      : stage === 'done' && result
        ? `완료 — 성공 ${result.ok} / 실패 ${result.fail}`
        : 'CSV 또는 구글시트 일괄 업로드';

  return (
    <EditDialog
      open={open}
      title="일괄 업로드"
      subtitle={subtitle}
      onClose={onClose}
      onSave={onSave}
      saving={busy}
      width={720}
    >
      {stage === 'input' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 탭 */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'sheet' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setMode('sheet')}
              style={{ flex: 1 }}
            >
              <i className="ph ph-google-logo" /> 구글 시트
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'file' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setMode('file')}
              style={{ flex: 1 }}
            >
              <i className="ph ph-file-csv" /> CSV 파일
            </button>
          </div>

          {mode === 'sheet' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSheetLoad();
                }}
              />
              <div className="text-text-muted" style={{ fontSize: 11 }}>
                * 시트 공유 → <b>링크가 있는 모든 사용자: 뷰어</b>로 설정해야 합니다
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onSheetLoad}
                disabled={busy}
              >
                {busy ? '시트 불러오는 중...' : '시트 불러오기'}
              </button>
            </div>
          ) : (
            <label className="jpk-uploader-drop" style={{ padding: 24, cursor: 'pointer' }}>
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  if (e.target.files?.[0]) void onFile(e.target.files[0]);
                  e.target.value = '';
                }}
              />
              <i className="ph ph-upload-simple" style={{ fontSize: 24 }} />
              <div>
                <div style={{ fontWeight: 600 }}>CSV 파일 선택</div>
                <div className="text-2xs text-text-muted">클릭 또는 드래그</div>
              </div>
            </label>
          )}

          <div
            style={{
              padding: 10,
              background: 'var(--c-bg-sub)',
              border: '1px solid var(--c-border)',
              borderRadius: 2,
              fontSize: 11,
              lineHeight: 1.6,
            }}
          >
            <b>자동 인식 가능한 유형:</b>
            <div style={{ marginTop: 4, color: 'var(--c-text-sub)' }}>
              {DETECTORS.map((d) => (
                <span key={d.key} style={{ marginRight: 10 }}>
                  <i className={`ph ${d.icon}`} /> {d.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {stage === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 유형 변경 (수동 오버라이드) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--c-text-sub)' }}>유형:</span>
            <select
              className="input"
              value={detector?.key ?? ''}
              onChange={(e) => setDetector(DETECTORS.find((d) => d.key === e.target.value) ?? null)}
              style={{ flex: 1 }}
            >
              <option value="">선택...</option>
              {DETECTORS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setStage('input')}
            >
              <i className="ph ph-arrow-left" /> 다시
            </button>
          </div>

          {/* 미리보기 (5행) */}
          <div
            style={{
              maxHeight: 280,
              overflow: 'auto',
              border: '1px solid var(--c-border)',
              borderRadius: 2,
            }}
          >
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--c-bg-sub)' }}>
                <tr>
                  {headers.map((h, i) => (
                    <th
                      // biome-ignore lint/suspicious/noArrayIndexKey: 미리보기 헤더 정적
                      key={`h-${i}`}
                      style={{
                        textAlign: 'left',
                        padding: '4px 8px',
                        borderBottom: '1px solid var(--c-border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.slice(0, 5).map((r, i) => (
                  <tr
                    // biome-ignore lint/suspicious/noArrayIndexKey: 미리보기 5행 정적
                    key={`row-${i}`}
                  >
                    {r.map((c, j) => (
                      <td
                        // biome-ignore lint/suspicious/noArrayIndexKey: 미리보기 셀 정적
                        key={`c-${i}-${j}`}
                        style={{
                          padding: '4px 8px',
                          borderBottom: '1px solid var(--c-border)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-text-muted" style={{ fontSize: 11 }}>
            상단 5행 미리보기 · 총 {dataRows.length}행
          </div>
        </div>
      )}

      {stage === 'done' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <span style={{ color: 'var(--c-success)', fontWeight: 600 }}>
              <i className="ph ph-check-circle" /> 성공 {result.ok}건
            </span>
            {result.fail > 0 && (
              <span style={{ color: 'var(--c-danger)', fontWeight: 600 }}>
                <i className="ph ph-x-circle" /> 실패 {result.fail}건
              </span>
            )}
          </div>
          {result.errors.length > 0 && (
            <div
              style={{
                maxHeight: 180,
                overflow: 'auto',
                background: 'var(--c-danger-bg, #fee)',
                color: '#991b1b',
                padding: '8px 12px',
                borderRadius: 2,
                fontSize: 11,
              }}
            >
              {result.errors.slice(0, 30).map((e) => (
                <div key={`err-${e.row}-${e.message}`}>
                  행 {e.row}: {e.message}
                </div>
              ))}
              {result.errors.length > 30 && <div>... 외 {result.errors.length - 30}건</div>}
            </div>
          )}
        </div>
      )}

      {/* 하단 액션 라벨 변경을 위한 hidden — EditDialog는 onSave 라벨 직접 못 바꿈 */}
      <div style={{ display: 'none' }}>{primaryLabel}</div>
    </EditDialog>
  );
}
