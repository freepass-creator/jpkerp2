'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import { Workspace } from '@/components/shared/panel';
import { JpkGrid, type JpkGridApi } from '@/components/shared/jpk-grid';
import { typedColumn } from '@/lib/grid/typed-column';
import { toast } from 'sonner';
import { ref as rtdbRef, push, set } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import { parseCsvObjects } from '@/lib/csv';
import { deriveBillingsFromContract } from '@/lib/derive/billings';
import type { RtdbContract } from '@/lib/types/rtdb-entities';
import type { ColDef } from 'ag-grid-community';

// ───────── 스키마 정의 (간단 버전) ─────────
interface SchemaField {
  col: string;
  label: string;
  required?: boolean;
  num?: boolean;
}

interface TypeSpec {
  key: string;
  label: string;
  schema: SchemaField[];
  path: string; // RTDB 저장 경로
  groupLabel?: string;
}

const SCHEMAS: TypeSpec[] = [
  {
    key: 'asset', label: '자산 (차량)', path: 'assets', groupLabel: '기본 마스터',
    schema: [
      { col: 'partner_code', label: '회원사코드', required: true },
      { col: 'car_number', label: '차량번호', required: true },
      { col: 'vin', label: '차대번호' },
      { col: 'manufacturer', label: '제조사' },
      { col: 'car_model', label: '모델' },
      { col: 'detail_model', label: '세부모델' },
      { col: 'car_year', label: '연식', num: true },
      { col: 'fuel_type', label: '연료' },
      { col: 'ext_color', label: '외장색' },
      { col: 'first_registration_date', label: '최초등록일' },
    ],
  },
  {
    key: 'contract', label: '계약', path: 'contracts', groupLabel: '기본 마스터',
    schema: [
      { col: 'partner_code', label: '회원사코드', required: true },
      { col: 'contract_code', label: '계약코드' },
      { col: 'car_number', label: '차량번호', required: true },
      { col: 'contractor_name', label: '계약자명', required: true },
      { col: 'contractor_phone', label: '연락처' },
      { col: 'start_date', label: '시작일', required: true },
      { col: 'end_date', label: '종료일' },
      { col: 'rent_months', label: '기간(개월)', num: true },
      { col: 'rent_amount', label: '월 대여료', num: true },
      { col: 'deposit_amount', label: '보증금', num: true },
    ],
  },
  {
    key: 'customer', label: '고객', path: 'customers', groupLabel: '기본 마스터',
    schema: [
      { col: 'partner_code', label: '회원사코드' },
      { col: 'name', label: '이름', required: true },
      { col: 'phone', label: '연락처', required: true },
      { col: 'birth', label: '생년월일' },
      { col: 'address', label: '주소' },
      { col: 'license_no', label: '면허번호' },
    ],
  },
  {
    key: 'member', label: '회원사', path: 'partners', groupLabel: '기본 마스터',
    schema: [
      { col: 'partner_code', label: '회원사코드', required: true },
      { col: 'partner_name', label: '회원사명', required: true },
      { col: 'ceo', label: '대표자' },
      { col: 'biz_no', label: '사업자번호' },
      { col: 'phone', label: '전화' },
      { col: 'contact_name', label: '담당자' },
    ],
  },
  {
    key: 'vendor', label: '거래처', path: 'vendors', groupLabel: '기본 마스터',
    schema: [
      { col: 'vendor_name', label: '거래처명', required: true },
      { col: 'vendor_type', label: '업종' },
      { col: 'contact_name', label: '담당자' },
      { col: 'phone', label: '연락처' },
      { col: 'biz_no', label: '사업자번호' },
      { col: 'bank_account', label: '계좌' },
    ],
  },
  {
    key: 'loan', label: '할부', path: 'loans', groupLabel: '기본 마스터',
    schema: [
      { col: 'car_number', label: '차량번호', required: true },
      { col: 'loan_company', label: '금융사' },
      { col: 'loan_principal', label: '원금', num: true },
      { col: 'loan_balance', label: '잔액', num: true },
      { col: 'monthly_payment', label: '월 납입', num: true },
      { col: 'loan_end_date', label: '만기일' },
    ],
  },
  {
    key: 'insurance', label: '보험', path: 'insurances', groupLabel: '기본 마스터',
    schema: [
      { col: 'car_number', label: '차량번호', required: true },
      { col: 'insurance_company', label: '보험사' },
      { col: 'policy_no', label: '증권번호' },
      { col: 'start_date', label: '개시일' },
      { col: 'end_date', label: '만기일' },
      { col: 'premium', label: '보험료', num: true },
    ],
  },
  {
    key: 'gps', label: 'GPS 장착', path: 'gps_devices', groupLabel: '기본 마스터',
    schema: [
      { col: 'car_number', label: '차량번호', required: true },
      { col: 'partner_code', label: '회원사코드' },
      { col: 'gps_company', label: '제조사' },
      { col: 'gps_serial', label: '시리얼번호', required: true },
      { col: 'gps_install_date', label: '장착일' },
      { col: 'gps_status', label: '상태' },
      { col: 'gps_location', label: '장착 위치' },
    ],
  },
  {
    key: 'autodebit', label: '자동이체', path: 'autodebits', groupLabel: '기본 마스터',
    schema: [
      { col: 'contract_code', label: '계약코드', required: true },
      { col: 'bank_name', label: '은행' },
      { col: 'account_no', label: '계좌번호', required: true },
      { col: 'holder', label: '예금주' },
      { col: 'debit_day', label: '이체일', num: true },
      { col: 'amount', label: '금액', num: true },
    ],
  },
  {
    key: 'bank', label: '통장 거래내역', path: 'events', groupLabel: '거래·이력',
    schema: [
      { col: 'date', label: '일자', required: true },
      { col: 'amount', label: '금액', required: true, num: true },
      { col: 'title', label: '내역', required: true },
      { col: 'vendor', label: '거래처' },
      { col: 'memo', label: '메모' },
    ],
  },
  {
    key: 'card', label: '카드 이용내역', path: 'events', groupLabel: '거래·이력',
    schema: [
      { col: 'date', label: '일자', required: true },
      { col: 'amount', label: '금액', required: true, num: true },
      { col: 'title', label: '가맹점', required: true },
      { col: 'vendor', label: '거래처' },
      { col: 'memo', label: '메모' },
    ],
  },
];

// 헤더 매핑 — 스키마 라벨과 비슷한 헤더를 col로 매핑
function mapHeaders(rows: Array<Record<string, string>>, schema: SchemaField[]): Array<Record<string, unknown>> {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const map: Record<string, string> = {};
  for (const h of headers) {
    const match = schema.find((f) => f.label === h || f.col === h);
    if (match) map[h] = match.col;
  }
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [h, v] of Object.entries(r)) {
      const key = map[h] ?? h;
      const fld = schema.find((f) => f.col === key);
      out[key] = fld?.num ? (Number(String(v).replace(/,/g, '')) || 0) : v;
    }
    return out;
  });
}

// ───────── 컴포넌트 ─────────
export function UploadClient() {
  const [typeKey, setTypeKey] = useState<string>('auto');
  const [rawRows, setRawRows] = useState<Array<Record<string, string>>>([]);
  const [detectedKey, setDetectedKey] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const gridRef = useRef<JpkGridApi<Record<string, unknown>> | null>(null);

  const effectiveKey = typeKey === 'auto' ? detectedKey : typeKey;
  const spec = SCHEMAS.find((s) => s.key === effectiveKey);

  const mappedRows = useMemo(() => {
    if (!spec) return [];
    return mapHeaders(rawRows, spec.schema);
  }, [rawRows, spec]);

  const columnDefs = useMemo<ColDef[]>(() => {
    if (!spec) return [];
    return [
      typedColumn<Record<string, unknown>>('action', { headerName: '#', valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1, width: 45, cellStyle: { color: 'var(--c-text-muted)' } }),
      ...spec.schema.map((f) =>
        typedColumn<Record<string, unknown>>(f.num ? 'number' : 'text', {
          headerName: f.label + (f.required ? ' *' : ''),
          field: f.col,
          width: 120,
        } as ColDef<Record<string, unknown>>),
      ),
    ];
  }, [spec]);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const rows = parseCsvObjects(text);
    setRawRows(rows);
    // 자동 감지 — 각 스키마별 label 매칭률 계산
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      let best = { key: '', score: 0 };
      for (const s of SCHEMAS) {
        const score = s.schema.filter((f) => headers.includes(f.label) || headers.includes(f.col)).length;
        if (score > best.score) best = { key: s.key, score };
      }
      if (best.score > 0) setDetectedKey(best.key);
      toast.success(`${rows.length}행 파싱 · ${best.key ? `감지: ${SCHEMAS.find((s) => s.key === best.key)?.label}` : '유형 선택 필요'}`);
    }
  }, []);

  const copyHeaders = useCallback(() => {
    if (!spec) return;
    const line = spec.schema.map((f) => f.label).join('\t');
    navigator.clipboard.writeText(line);
    toast.success('헤더 복사됨 (Excel에 붙여넣기)');
  }, [spec]);

  const downloadSample = useCallback(() => {
    if (!spec) return;
    const csv = `${spec.schema.map((f) => f.label).join(',')}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${spec.key}_sample.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [spec]);

  const reset = useCallback(() => {
    setRawRows([]);
    setDetectedKey(null);
    setFileName('');
  }, []);

  const commit = useCallback(async () => {
    if (!spec || mappedRows.length === 0) return;
    setSaving(true);
    try {
      const base = rtdbRef(getRtdb(), spec.path);
      let ok = 0;
      let derivedBillings = 0;
      for (const row of mappedRows) {
        // 필수필드 검증
        const missing = spec.schema.filter((f) => f.required && !row[f.col]).map((f) => f.label);
        if (missing.length) continue;
        const payload = { ...row, created_at: Date.now(), status: 'active' };
        const r = push(base);
        await set(r, payload);
        ok++;

        // 계약 업로드 시 billings 자동 파생
        if (spec.key === 'contract' && r.key) {
          try {
            const dr = await deriveBillingsFromContract({ ...payload, _key: r.key } as RtdbContract);
            derivedBillings += dr.created;
          } catch { /* 파생 실패는 전체 저장 중단 안 함 */ }
        }
      }
      const derivedMsg = derivedBillings > 0 ? ` · 수납스케줄 ${derivedBillings}건 자동 생성` : '';
      toast.success(`${ok}건 저장 (${mappedRows.length - ok}건 필수필드 누락 스킵)${derivedMsg}`);
      reset();
    } catch (e) {
      toast.error(`저장 실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [spec, mappedRows, reset]);

  return (
    <Workspace layout="layout-37">
      {/* Panel 1 — 업로드 컨트롤 */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <i className="ph ph-upload-simple" />
            <span className="panel-title">업로드</span>
          </div>
          <div className="panel-head-actions">
            <button type="button" className="btn btn-sm btn-outline" onClick={reset}>
              <i className="ph ph-arrow-counter-clockwise" /> 초기화
            </button>
          </div>
        </div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ① 데이터 종류 */}
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>① 데이터 종류</label>
            <select
              className="select"
              value={typeKey}
              onChange={(e) => setTypeKey(e.target.value)}
            >
              <option value="auto">자동 감지</option>
              <optgroup label="📂 기본 마스터">
                {SCHEMAS.filter((s) => s.groupLabel === '기본 마스터').map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </optgroup>
              <optgroup label="📊 거래·이력">
                {SCHEMAS.filter((s) => s.groupLabel === '거래·이력').map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </optgroup>
            </select>
            {typeKey === 'auto' && detectedKey && (
              <div className="form-hint" style={{ marginTop: 6 }}>
                ✓ 감지됨: <b>{SCHEMAS.find((s) => s.key === detectedKey)?.label}</b>
              </div>
            )}
          </div>

          {/* ② 스키마 안내 */}
          {spec && (
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                ② 스키마 항목 <span className="text-text-muted">({spec.schema.length}개)</span>
              </label>
              <div
                style={{
                  background: 'var(--c-bg-sub)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 2,
                  padding: 10,
                  maxHeight: 140,
                  overflowY: 'auto',
                  fontSize: 11,
                  lineHeight: 1.7,
                }}
              >
                {spec.schema.map((f) => (
                  <span key={f.col} style={{ marginRight: 8 }}>
                    <span style={{ color: f.required ? 'var(--c-danger)' : 'var(--c-text-sub)' }}>
                      {f.label}{f.required && '*'}
                    </span>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 6 }}>
                <button type="button" className="btn btn-sm btn-outline" onClick={copyHeaders}>
                  <i className="ph ph-copy" /> 헤더 복사
                </button>
                <button type="button" className="btn btn-sm btn-outline" onClick={downloadSample}>
                  <i className="ph ph-download-simple" /> 샘플 다운
                </button>
              </div>
            </div>
          )}

          {/* ③ 업로드 */}
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>③ 파일 업로드</label>
            <label
              className="jpk-uploader-drop"
              onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
              }}
              style={{
                borderColor: dragOver ? 'var(--c-primary)' : 'var(--c-border)',
                background: dragOver ? 'var(--c-primary-bg)' : 'var(--c-bg-sub)',
              }}
            >
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                hidden
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
              />
              <i className="ph ph-upload-simple" style={{ fontSize: 18 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {fileName || 'CSV 파일 업로드'}
                </div>
                <div className="text-text-muted" style={{ fontSize: 10 }}>
                  클릭 또는 드래그 · 첫 행은 헤더
                </div>
              </div>
            </label>
          </div>

          {/* ④ 감지 결과 */}
          {rawRows.length > 0 && (
            <div
              style={{
                padding: 10,
                background: 'var(--c-success-bg)',
                border: '1px solid var(--c-success)',
                borderRadius: 2,
                fontSize: 11,
                color: 'var(--c-success)',
              }}
            >
              ✓ <b>{rawRows.length}</b>행 파싱 완료 {spec && ` · ${spec.label}로 매핑`}
            </div>
          )}
        </div>
      </section>

      {/* Panel 2 — 미리보기 */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <i className="ph ph-eye" />
            <span className="panel-title">데이터 미리보기</span>
            <span className="panel-subtitle">
              {fileName || '파일을 업로드하세요'}
              {mappedRows.length > 0 && ` · ${mappedRows.length}건`}
            </span>
          </div>
          <div className="panel-head-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={commit}
              disabled={!spec || mappedRows.length === 0 || saving}
            >
              {saving ? (<><i className="ph ph-spinner spin" /> 저장 중...</>) : (<><i className="ph ph-check" /> 반영</>)}
            </button>
          </div>
        </div>
        <div className="panel-body no-pad" style={{ overflow: 'hidden' }}>
          {mappedRows.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-2 text-text-muted"
              style={{ padding: 40, height: '100%' }}
            >
              <i className="ph ph-table" style={{ fontSize: 32 }} />
              <div style={{ fontSize: 12 }}>좌측에서 파일을 업로드하면 여기에 미리보기가 표시됩니다</div>
            </div>
          ) : (
            <JpkGrid
              ref={gridRef}
              columnDefs={columnDefs}
              rowData={mappedRows}
              storageKey={`jpk.grid.upload.${spec?.key ?? 'unknown'}`}
            />
          )}
        </div>
      </section>
    </Workspace>
  );
}
