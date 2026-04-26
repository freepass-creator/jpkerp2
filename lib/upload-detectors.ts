/**
 * upload-detectors — CSV/시트 헤더 보고 자동 유형 판별 + 저장 라우팅.
 *
 * V1 `pages/upload.js`의 DETECTORS 패턴 이식.
 *
 * 흐름:
 *   1. detect(headers) → 어떤 detector인지 결정 (첫 매칭 우선)
 *   2. parse(rows, headers) → 정규화된 객체 배열
 *   3. validate(row) → 행별 오류 메시지 배열 (선택)
 *   4. save(row) → RTDB 저장 (events 또는 컬렉션 push)
 *   5. isDup(row, existing) → 중복 row 체크 (선택)
 *
 * 새 detector 추가 시:
 *   - lib/parsers/ 에 detect/parseRow 만들거나
 *   - 헤더만 보고 직접 detect 함수 작성
 */
import { saveEvent } from '@/lib/firebase/events';
import { getRtdb } from '@/lib/firebase/rtdb';
import { sanitizeCarNumber } from '@/lib/format-input';
import * as bankShinhan from '@/lib/parsers/bank-shinhan';
import * as cardShinhan from '@/lib/parsers/card-shinhan';
import { push, ref, serverTimestamp, set } from 'firebase/database';

export interface DetectorContext {
  user?: { uid?: string; email?: string | null; displayName?: string | null };
}

export interface DetectorResult {
  ok: number;
  fail: number;
  errors: { row: number; message: string }[];
}

export interface Detector<TRow = Record<string, unknown>> {
  /** 내부 식별자 */
  key: string;
  /** UI에 표시할 라벨 */
  label: string;
  /** 아이콘 (Phosphor) */
  icon: string;
  /** 헤더 배열만 보고 매칭 여부 결정 */
  detect: (headers: string[]) => boolean;
  /** 파싱 — null/undefined 항목은 자동 제외 */
  parse: (rows: string[][], headers: string[]) => TRow[];
  /** 행 단위 검증 — 오류 메시지 배열 (없으면 [] 반환) */
  validate?: (row: TRow) => string[];
  /** 행 저장 */
  save: (row: TRow, ctx: DetectorContext) => Promise<void>;
}

/* ─── 공용 헬퍼 ─────────────────────────────── */

function normalizeDate(s: unknown): string {
  if (!s) return '';
  let v = String(s)
    .trim()
    .replace(/년|월/g, '-')
    .replace(/일/g, '')
    .replace(/[./]/g, '-')
    .replace(/\s+/g, '');
  if (/^\d{8}$/.test(v)) v = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}`;
  if (/^\d{6}$/.test(v)) {
    const y = Number(v.slice(0, 2));
    v = `${y < 50 ? 2000 + y : 1900 + y}-${v.slice(2, 4)}-${v.slice(4)}`;
  }
  const m2 = v.match(/^(\d{2})-(\d{1,2})-(\d{1,2})$/);
  if (m2) {
    const y = Number(m2[1]);
    v = `${y < 50 ? 2000 + y : 1900 + y}-${String(m2[2]).padStart(2, '0')}-${String(m2[3]).padStart(2, '0')}`;
  }
  const m4 = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m4) v = `${m4[1]}-${String(m4[2]).padStart(2, '0')}-${String(m4[3]).padStart(2, '0')}`;
  return v;
}

function normalizeNum(s: unknown): number | undefined {
  if (s === '' || s === null || s === undefined) return undefined;
  const n = Number(String(s).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/** 헤더 배열로부터 인덱스 매핑 (한국어 컬럼명 + 별칭 지원) */
export function buildHeaderIndex(
  headers: string[],
  schema: { col: string; aliases?: string[] }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  const norm = (s: string) =>
    String(s ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/\([^)]*\)/g, '');
  for (const s of schema) {
    const candidates = [s.col, ...(s.aliases ?? [])].map(norm);
    const idx = headers.findIndex((h) => candidates.includes(norm(h)));
    if (idx >= 0) out[s.col] = idx;
  }
  return out;
}

async function pushTo(collection: string, payload: Record<string, unknown>): Promise<void> {
  const db = getRtdb();
  const r = push(ref(db, collection));
  await set(r, {
    ...payload,
    created_at: Date.now(),
    updated_at: serverTimestamp(),
    status: payload.status ?? 'active',
  });
}

/* ─── DETECTORS ─────────────────────────────── */

const ASSET_SCHEMA = [
  { col: 'partner_code', aliases: ['회원사코드', '회사코드'] },
  { col: 'car_number', aliases: ['차량번호'] },
  { col: 'vin', aliases: ['차대번호', 'VIN'] },
  { col: 'manufacturer', aliases: ['제조사'] },
  { col: 'car_model', aliases: ['모델', '차종'] },
  { col: 'detail_model', aliases: ['세부모델', '트림'] },
  { col: 'car_year', aliases: ['연식'] },
  { col: 'fuel_type', aliases: ['연료'] },
  { col: 'first_registration_date', aliases: ['최초등록일'] },
  { col: 'acquisition_cost', aliases: ['매입가', '취득가'] },
  { col: 'acquisition_date', aliases: ['매입일자', '취득일'] },
  { col: 'dealer_name', aliases: ['매입처', '딜러'] },
];

const CONTRACT_SCHEMA = [
  { col: 'contract_code', aliases: ['계약코드', '계약번호'] },
  { col: 'partner_code', aliases: ['회원사코드', '회사코드'] },
  { col: 'car_number', aliases: ['차량번호'] },
  { col: 'contractor_name', aliases: ['계약자', '계약자명'] },
  { col: 'contractor_phone', aliases: ['연락처', '전화'] },
  { col: 'contractor_reg_no', aliases: ['고객등록번호', '주민번호', '사업자번호'] },
  { col: 'start_date', aliases: ['시작일', '계약시작일'] },
  { col: 'end_date', aliases: ['종료일', '만기일', '반납일'] },
  { col: 'rent_months', aliases: ['계약기간', '개월수'] },
  { col: 'rent_amount', aliases: ['월대여료', '대여료'] },
  { col: 'deposit_amount', aliases: ['보증금'] },
  { col: 'auto_debit_day', aliases: ['결제일', '출금일'] },
  { col: 'product_type', aliases: ['상품', '상품유형'] },
];

const CUSTOMER_SCHEMA = [
  { col: 'customer_code', aliases: ['고객코드'] },
  { col: 'name', aliases: ['이름', '성명', '계약자'] },
  { col: 'phone', aliases: ['연락처', '전화', '휴대폰'] },
  { col: 'birth', aliases: ['생년월일', '주민번호'] },
  { col: 'address', aliases: ['주소'] },
  { col: 'license_no', aliases: ['면허번호'] },
  { col: 'biz_no', aliases: ['사업자번호', '법인번호'] },
  { col: 'customer_type', aliases: ['구분', '고객구분'] },
];

const PARTNER_SCHEMA = [
  { col: 'partner_code', aliases: ['회원사코드', '회사코드'] },
  { col: 'partner_name', aliases: ['회사명', '회원사명'] },
  { col: 'biz_no', aliases: ['사업자번호'] },
  { col: 'corp_no', aliases: ['법인등록번호', '법인번호'] },
  { col: 'ceo', aliases: ['대표자', '대표'] },
  { col: 'phone', aliases: ['연락처', '전화'] },
  { col: 'address', aliases: ['주소'] },
];

function rowsToObjects<T extends { col: string }>(
  rows: string[][],
  headers: string[],
  schema: T[],
  dateCols: Set<string>,
  numCols: Set<string>,
): Record<string, unknown>[] {
  const idx = buildHeaderIndex(headers, schema);
  return rows
    .map((row): Record<string, unknown> | null => {
      const obj: Record<string, unknown> = {};
      let hasAny = false;
      for (const s of schema) {
        const i = idx[s.col];
        if (i === undefined) continue;
        const raw = String(row[i] ?? '').trim();
        if (!raw) continue;
        let v: string | number = raw;
        if (dateCols.has(s.col)) v = normalizeDate(raw);
        if (numCols.has(s.col)) {
          const n = normalizeNum(raw);
          if (n !== undefined) v = n;
        }
        obj[s.col] = v;
        hasAny = true;
      }
      return hasAny ? obj : null;
    })
    .filter((r): r is Record<string, unknown> => r !== null);
}

const empty = (v: unknown): boolean => {
  if (v === undefined || v === null) return true;
  const s = String(v).trim();
  return s === '' || s === '-' || s === '_' || s === 'N/A' || s === 'null';
};

/* ── 1. 신한은행 통장내역 ── */
const BANK_SHINHAN: Detector = {
  key: 'bank_shinhan',
  label: '신한은행 통장내역',
  icon: 'ph-bank',
  detect: (headers) => bankShinhan.detect(headers),
  parse: (rows, headers) =>
    rows
      .map((r) => bankShinhan.parseRow(r, headers))
      .filter(
        (r): r is NonNullable<ReturnType<typeof bankShinhan.parseRow>> => r !== null,
      ) as unknown as Record<string, unknown>[],
  save: async (row) => {
    await saveEvent(row as Parameters<typeof saveEvent>[0]);
  },
};

/* ── 2. 신한카드 이용내역 ── */
const CARD_SHINHAN: Detector = {
  key: 'card_shinhan',
  label: '신한카드 이용내역',
  icon: 'ph-credit-card',
  detect: (headers) => cardShinhan.detect(headers),
  parse: (rows, headers) =>
    rows
      .map((r) => cardShinhan.parseRow(r, headers))
      .filter(
        (r): r is NonNullable<ReturnType<typeof cardShinhan.parseRow>> => r !== null,
      ) as unknown as Record<string, unknown>[],
  save: async (row) => {
    await saveEvent(row as Parameters<typeof saveEvent>[0]);
  },
};

/* ── 3. 자산(차량) 데이터 ── */
const ASSET: Detector = {
  key: 'asset',
  label: '자산(차량) 데이터',
  icon: 'ph-car',
  detect: (headers) => {
    const idx = buildHeaderIndex(headers, ASSET_SCHEMA);
    // 자산 = vin 또는 (제조사+모델) 있고, 계약자명 없음
    return (
      (idx.vin !== undefined || (idx.manufacturer !== undefined && idx.car_model !== undefined)) &&
      buildHeaderIndex(headers, CONTRACT_SCHEMA).contractor_name === undefined
    );
  },
  parse: (rows, headers) =>
    rowsToObjects(
      rows,
      headers,
      ASSET_SCHEMA,
      new Set(['first_registration_date', 'acquisition_date']),
      new Set(['car_year', 'acquisition_cost']),
    ).map((row) => ({
      ...row,
      car_number: row.car_number ? sanitizeCarNumber(String(row.car_number)) : row.car_number,
    })),
  validate: (row) => {
    const errs: string[] = [];
    if (empty(row.partner_code)) errs.push('회원사코드');
    if (empty(row.car_number)) errs.push('차량번호');
    if (!empty(row.vin) && String(row.vin).length !== 17)
      errs.push(`VIN ${String(row.vin).length}자(17자 필요)`);
    if (!empty(row.car_number) && !/\d{2,3}[가-힣]\d{4}/.test(String(row.car_number)))
      errs.push('차량번호 형식');
    return errs;
  },
  save: async (row) => {
    await pushTo('assets', row);
  },
};

/* ── 4. 계약 데이터 ── */
const CONTRACT: Detector = {
  key: 'contract',
  label: '계약 데이터',
  icon: 'ph-file-text',
  detect: (headers) => {
    const idx = buildHeaderIndex(headers, CONTRACT_SCHEMA);
    // 계약 = 차량번호 + (계약자명 또는 등록번호)
    return (
      idx.car_number !== undefined &&
      (idx.contractor_name !== undefined || idx.contractor_reg_no !== undefined)
    );
  },
  parse: (rows, headers) =>
    rowsToObjects(
      rows,
      headers,
      CONTRACT_SCHEMA,
      new Set(['start_date', 'end_date']),
      new Set(['rent_months', 'rent_amount', 'deposit_amount']),
    ).map((row) => ({
      ...row,
      car_number: row.car_number ? sanitizeCarNumber(String(row.car_number)) : row.car_number,
    })),
  validate: (row) => {
    const errs: string[] = [];
    if (empty(row.partner_code)) errs.push('회원사코드');
    if (empty(row.car_number)) errs.push('차량번호');
    if (empty(row.contractor_name)) errs.push('계약자');
    if (empty(row.contractor_phone)) errs.push('연락처');
    if (empty(row.start_date)) errs.push('시작일');
    return errs;
  },
  save: async (row) => {
    await pushTo('contracts', row);
  },
};

/* ── 5. 고객 데이터 ── */
const CUSTOMER: Detector = {
  key: 'customer',
  label: '고객 데이터',
  icon: 'ph-user',
  detect: (headers) => {
    const idx = buildHeaderIndex(headers, CUSTOMER_SCHEMA);
    const cIdx = buildHeaderIndex(headers, CONTRACT_SCHEMA);
    // 고객 = 이름 + (생년월일 또는 면허번호 또는 사업자번호) 있고, 차량번호 없음
    return (
      idx.name !== undefined &&
      (idx.birth !== undefined || idx.license_no !== undefined || idx.biz_no !== undefined) &&
      cIdx.car_number === undefined
    );
  },
  parse: (rows, headers) => rowsToObjects(rows, headers, CUSTOMER_SCHEMA, new Set(), new Set()),
  validate: (row) => {
    const errs: string[] = [];
    if (empty(row.name)) errs.push('이름');
    return errs;
  },
  save: async (row) => {
    await pushTo('customers', row);
  },
};

/* ── 6. 회원사 데이터 ── */
const PARTNER: Detector = {
  key: 'partner',
  label: '회원사 데이터',
  icon: 'ph-buildings',
  detect: (headers) => {
    const idx = buildHeaderIndex(headers, PARTNER_SCHEMA);
    return idx.partner_name !== undefined && idx.biz_no !== undefined;
  },
  parse: (rows, headers) => rowsToObjects(rows, headers, PARTNER_SCHEMA, new Set(), new Set()),
  validate: (row) => {
    const errs: string[] = [];
    if (empty(row.partner_name)) errs.push('회사명');
    if (empty(row.biz_no)) errs.push('사업자번호');
    return errs;
  },
  save: async (row) => {
    await pushTo('partners', row);
  },
};

/* DETECTORS — 첫 매칭 우선. 더 좁은(특이적인) 조건이 앞에 위치해야 함 */
export const DETECTORS: readonly Detector[] = [
  BANK_SHINHAN,
  CARD_SHINHAN,
  CONTRACT, // 계약 = 차량+계약자 — 자산보다 먼저 (자산은 계약자 없음)
  ASSET,
  PARTNER,
  CUSTOMER,
];

export interface DetectionResult {
  detector: Detector | null;
  reason: string;
}

/** 헤더 배열을 보고 첫 번째로 매칭되는 detector 반환 */
export function detectType(headers: string[]): DetectionResult {
  for (const d of DETECTORS) {
    if (d.detect(headers)) return { detector: d, reason: d.label };
  }
  return { detector: null, reason: '유형 자동 인식 실패' };
}
