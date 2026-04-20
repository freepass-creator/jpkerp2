'use client';

import { useCallback, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { toast } from 'sonner';
import { uploadFiles } from '@/lib/firebase/storage';
import { ocrFile, extractAmount, extractCarNumber, extractDate } from '@/lib/ocr';

export interface PhotoUploaderHandle {
  /** 폼 저장 시 호출 — 파일 업로드 후 다운로드 URL 반환 */
  commitUpload: (basePath: string) => Promise<string[]>;
  getFiles: () => File[];
  clear: () => void;
}

export interface OcrResult {
  amount: number | null;
  date: string | null;
  car_number: string | null;
  text: string;
}

interface Props {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  label?: string;
  /** OCR 버튼 노출 — 클릭 시 첫 파일 OCR 후 amount/date/car_number 추출하여 호출 */
  onOcrExtract?: (result: OcrResult) => void;
}

/**
 * 사진·파일 업로더 — 선택 시 미리보기, 저장 시 commitUpload()로 Firebase Storage 업로드.
 */
export const PhotoUploader = forwardRef<PhotoUploaderHandle, Props>(function PhotoUploader(
  { accept = 'image/*,.pdf', multiple = true, maxFiles = 10, label = '사진·파일', onOcrExtract },
  ref,
) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [uploading, setUploading] = useState(false);
  const [ocring, setOcring] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function runOcr() {
    if (files.length === 0) { toast.error('파일을 먼저 선택하세요'); return; }
    setOcring(true);
    try {
      const result = await ocrFile(files[0], {
        onProgress: (p) => setOcrStatus(p.message),
      });
      const extracted: OcrResult = {
        amount: extractAmount(result.text),
        date: extractDate(result.text),
        car_number: extractCarNumber(result.text),
        text: result.text,
      };
      const filled = [];
      if (extracted.amount) filled.push(`금액 ${extracted.amount.toLocaleString()}원`);
      if (extracted.date) filled.push(`날짜 ${extracted.date}`);
      if (extracted.car_number) filled.push(`차량 ${extracted.car_number}`);
      toast.success(filled.length ? `자동 채움: ${filled.join(' · ')}` : 'OCR 완료 — 추출된 값 없음');
      onOcrExtract?.(extracted);
    } catch (e) {
      toast.error(`OCR 실패: ${(e as Error).message}`);
    } finally {
      setOcring(false);
      setOcrStatus('');
    }
  }

  const addFiles = useCallback((list: FileList | File[]) => {
    const arr = Array.from(list);
    setFiles((cur) => {
      const next = [...cur, ...arr].slice(0, maxFiles);
      // 이미지 미리보기 URL 생성
      const previewMap: Record<number, string> = {};
      next.forEach((f, i) => {
        if (f.type.startsWith('image/')) previewMap[i] = URL.createObjectURL(f);
      });
      setPreviews(previewMap);
      return next;
    });
  }, [maxFiles]);

  const remove = useCallback((idx: number) => {
    setFiles((cur) => cur.filter((_, i) => i !== idx));
    setPreviews((p) => {
      if (p[idx]) URL.revokeObjectURL(p[idx]);
      const copy = { ...p };
      delete copy[idx];
      return copy;
    });
  }, []);

  useImperativeHandle(ref, () => ({
    commitUpload: async (basePath) => {
      if (files.length === 0) return [];
      setUploading(true);
      try {
        return await uploadFiles(basePath, files);
      } finally {
        setUploading(false);
      }
    },
    getFiles: () => files,
    clear: () => {
      Object.values(previews).forEach((u) => URL.revokeObjectURL(u));
      setFiles([]);
      setPreviews({});
    },
  }), [files, previews]);

  return (
    <div className="jpk-uploader">
      <div
        className={`jpk-uploader-drop ${dragOver ? 'is-over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
      >
        <i className="ph ph-upload-simple text-[18px]" />
        <span className="text-base" style={{ letterSpacing: '-0.02em' }}>
          {files.length > 0 ? `${files.length}개 선택됨` : `${label} 드래그 또는 클릭`}
        </span>
        <span className="text-text-muted text-2xs">
          {files.length}/{maxFiles}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          style={{ display: 'none' }}
        />
      </div>

      {files.length > 0 && (
        <div className="jpk-uploader-list">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="jpk-uploader-item">
              {previews[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[i]} alt={f.name} className="jpk-uploader-thumb" />
              ) : (
                <div className="jpk-uploader-thumb jpk-uploader-thumb-file">
                  <i className="ph ph-file" />
                </div>
              )}
              <div className="jpk-uploader-meta">
                <div className="text-xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </div>
                <div className="text-text-muted text-2xs">
                  {(f.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); remove(i); }}
                aria-label="제거"
                className="jpk-uploader-del"
              >
                <i className="ph ph-x" />
              </button>
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <div className="text-text-muted text-xs" style={{ marginTop: 4 }}>
          <i className="ph ph-spinner spin" /> 업로드 중...
        </div>
      )}

      {/* OCR 버튼 */}
      {onOcrExtract && files.length > 0 && (
        <button
          type="button"
          onClick={runOcr}
          disabled={ocring}
          className="btn btn-outline btn-sm"
          style={{ alignSelf: 'flex-start' }}
        >
          {ocring ? (
            <><i className="ph ph-spinner spin" /> {ocrStatus || 'OCR 중...'}</>
          ) : (
            <><i className="ph ph-scan" /> OCR로 자동 채움</>
          )}
        </button>
      )}
    </div>
  );
});
