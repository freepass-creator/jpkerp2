/**
 * match-engine — 거래 자동 분류·매칭 엔진 (V1 이식).
 *
 * 통장 거래 한 건이 들어오면 동시에 처리:
 *   1. 출금 → 항목별 자동 분류 (할부/보험/정비/주유/세금 등 25+ 카테고리)
 *   2. 입금 → 계약/회차 후보 매칭 (이름·차번·이력 학습)
 *
 * 학습:
 *   같은 입금자 이름의 매칭 결과를 localStorage에 저장 → 다음 매칭 시 prefer.
 *   서버 reconcilePayment(payment-match.ts)는 그대로 사용 — 본 모듈은 후보 추천 / 분류만.
 */
import type { RtdbBilling, RtdbContract } from '@/lib/types/rtdb-entities';

/* ─── 정규식 패턴 ─────────────────────── */
const CAR_PATTERN = /(\d{2,3}[가-힣]\d{4})/;
const NAME_CAR_PATTERN = /^(.+?)[([（](.+?)[)\]）]/;

/* ─── 출금 항목 분류 규칙 ─────────────── */

export interface ExpenseRule {
  pattern: RegExp;
  category: string;
  type: string;
}

export const EXPENSE_RULES: readonly ExpenseRule[] = [
  // 차량 관련
  {
    pattern: /할부|캐피탈|저축은행|리스|오릭스|하나캐|KB캐|현대캐|BNK캐|JB우리|우리캐/i,
    category: '할부금',
    type: 'loan',
  },
  {
    pattern: /보험|삼성화재|현대해상|DB손해|KB손보|메리츠|한화손해|AXA|악사/i,
    category: '보험료',
    type: 'insurance',
  },
  {
    pattern: /정비|카센터|오토|부품|엔진|브레이크|배터리|에어컨|냉각/i,
    category: '정비비',
    type: 'maintenance',
  },
  { pattern: /세차|광택|코팅|폴리싱/i, category: '세차비', type: 'carwash' },
  { pattern: /타이어|금호|한국|넥센|미쉐린|브릿지/i, category: '타이어', type: 'tire' },
  {
    pattern: /주유|충전|SK에너지|GS칼텍스|S-OIL|현대오일|오일뱅크/i,
    category: '유류비',
    type: 'fuel',
  },
  { pattern: /도로공사|고속도로|통행료|하이패스/i, category: '통행료', type: 'toll' },
  { pattern: /주차|파킹/i, category: '주차비', type: 'parking' },
  { pattern: /과태료|범칙금|주정차|교통/i, category: '과태료', type: 'penalty' },
  { pattern: /탁송|운송|이동/i, category: '탁송비', type: 'transport' },
  { pattern: /대리|대리운전|대리의신/i, category: '대리운전', type: 'driver' },
  // 일반 경비
  { pattern: /CMS|수수료|이체수수료|자동이체/i, category: '수수료', type: 'fee' },
  { pattern: /급여|월급|상여|인건비/i, category: '인건비', type: 'salary' },
  {
    pattern: /임대|월세|관리비|공과금|전기|수도|가스/i,
    category: '임차료',
    type: 'rent',
  },
  { pattern: /세금|국세|지방세|부가세|원천/i, category: '세금', type: 'tax' },
  { pattern: /법원|등기|인지|송달/i, category: '법무비', type: 'legal' },
  { pattern: /우체국|우정|택배|배송/i, category: '우편/택배', type: 'postal' },
  { pattern: /카카오택시|택시/i, category: '교통비', type: 'taxi' },
  {
    pattern: /식당|음식|치킨|피자|커피|카페|빵|베이커리|다방|곰치|향기/i,
    category: '식대/접대',
    type: 'meal',
  },
  { pattern: /다이소|쿠팡|마트|편의점|GS25|CU|세븐/i, category: '소모품', type: 'supplies' },
  { pattern: /가비아|호스팅|도메인|서버|클라우드/i, category: 'IT비용', type: 'it' },
  { pattern: /네이버|페이|결제/i, category: '온라인결제', type: 'online' },
  { pattern: /골프|레저|컨트리/i, category: '접대비', type: 'entertainment' },
];

export interface ExpenseClassification {
  category: string;
  type: string;
}

/**
 * 거래 텍스트(상대처·적요·메모)에서 첫 매칭 규칙으로 분류.
 * 매칭 안 되면 '기타지출'.
 */
export function classifyExpense(text: string): ExpenseClassification {
  const s = String(text ?? '');
  for (const rule of EXPENSE_RULES) {
    if (rule.pattern.test(s)) return { category: rule.category, type: rule.type };
  }
  return { category: '기타지출', type: 'etc' };
}

/* ─── 상대처 파싱 ──────────────────────── */

export interface ParsedCounterparty {
  name: string;
  car: string;
  raw: string;
}

/**
 * "홍길동(123가4567)" / "홍길동 123가4567" / "홍길동" → { name, car }
 */
export function parseCounterparty(text: unknown): ParsedCounterparty {
  const s = String(text ?? '').trim();
  const result: ParsedCounterparty = { name: '', car: '', raw: s };

  const nc = NAME_CAR_PATTERN.exec(s);
  if (nc) {
    result.name = nc[1].trim();
    const inner = nc[2].trim();
    if (CAR_PATTERN.test(inner)) result.car = inner;
    return result;
  }

  const cm = CAR_PATTERN.exec(s);
  if (cm) {
    result.car = cm[1];
    result.name = s.replace(cm[0], '').trim();
    return result;
  }

  result.name = s;
  return result;
}

/* ─── 입금 매칭 학습 (브라우저 localStorage) ─── */

const HISTORY_KEY = 'jpk.match.history';

interface HistoryEntry {
  contract_code: string;
  contractor_name?: string;
  car_number?: string;
  car_hint?: string;
  last_date?: string;
}

type History = Record<string, HistoryEntry>;

function loadHistory(): History {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? '{}') as History;
  } catch {
    return {};
  }
}

function saveHistory(h: History): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch {
    /* localStorage quota / disabled */
  }
}

export function getMatchHistory(): History {
  return loadHistory();
}

export function clearMatchHistory(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(HISTORY_KEY);
}

/* ─── 입금 후보 매칭 ───────────────────── */

export type IncomeMatchStatus = 'auto' | 'candidate' | 'unmatched' | 'bulk';

export interface IncomeMatchHit {
  contract_code: string;
  contractor_name?: string;
  car_number?: string;
  billing_key?: string;
  bill_count?: number;
  confidence: 'high' | 'low';
}

export interface IncomeMatchResult {
  status: IncomeMatchStatus;
  category: string;
  matches: IncomeMatchHit[];
  best?: IncomeMatchHit;
  reason: string;
  parsed: ParsedCounterparty;
}

interface IncomeContext {
  contracts: readonly RtdbContract[];
  billings: readonly RtdbBilling[];
}

/**
 * 입금 거래 → 계약/미납 회차 후보 매칭.
 * 이름·차번 양쪽으로 후보 검색 + 학습 이력 폴백.
 * 금액 정확 일치 시 confidence='high', 아니면 'low'.
 */
export function matchIncome(
  event: { counterparty?: unknown; amount?: number | string; date?: string },
  ctx: IncomeContext,
): IncomeMatchResult {
  const parsed = parseCounterparty(event.counterparty);
  const { name, car, raw } = parsed;
  const amount = Number(event.amount) || 0;
  const date = event.date ?? '';
  const history = loadHistory();
  const { contracts, billings } = ctx;

  // CMS / 카드 일괄 입금
  if (/CMS|카드자동|자동집금|일괄/i.test(raw)) {
    return {
      status: 'bulk',
      category: '일괄입금',
      matches: [],
      reason: '자동이체/카드 일괄 — 명세 매칭 필요',
      parsed,
    };
  }

  // 1) 차량번호로 후보
  let candidates = car
    ? contracts.filter((c) => Boolean(c.car_number) && c.car_number?.includes(car))
    : [];

  // 2) 이름으로 후보
  if (!candidates.length && name) {
    candidates = contracts.filter((c) => {
      const cName = String(c.contractor_name ?? '').trim();
      return cName !== '' && (cName === name || cName.includes(name) || name.includes(cName));
    });
  }

  // 3) 학습 이력 폴백
  if (!candidates.length && name && history[name]?.contract_code) {
    const hc = contracts.find((c) => c.contract_code === history[name].contract_code);
    if (hc) candidates = [hc];
  }

  if (!candidates.length) {
    return {
      status: 'unmatched',
      category: '미매칭입금',
      matches: [],
      reason: `매칭 실패: "${raw}"`,
      parsed,
    };
  }

  // 미납 회차 매칭 — 금액 정확 일치 우선
  const results: IncomeMatchHit[] = [];
  for (const contract of candidates) {
    if (!contract.contract_code) continue;
    const unpaid = billings
      .filter((b) => b.contract_code === contract.contract_code)
      .filter((b) => (Number(b.paid_total) || 0) < (Number(b.amount) || 0))
      .sort((a, b) => Number(a.bill_count ?? 0) - Number(b.bill_count ?? 0));

    const exact = unpaid.find(
      (b) => (Number(b.amount) || 0) - (Number(b.paid_total) || 0) === amount,
    );

    if (exact) {
      results.push({
        contract_code: contract.contract_code,
        contractor_name: contract.contractor_name,
        car_number: contract.car_number,
        billing_key: exact._key,
        bill_count: exact.bill_count,
        confidence: 'high',
      });
    } else if (unpaid.length > 0) {
      results.push({
        contract_code: contract.contract_code,
        contractor_name: contract.contractor_name,
        car_number: contract.car_number,
        billing_key: unpaid[0]._key,
        bill_count: unpaid[0].bill_count,
        confidence: 'low',
      });
    }
  }

  if (!results.length) {
    return {
      status: 'unmatched',
      category: '미매칭입금',
      matches: [],
      reason: '계약 있으나 미납 회차 없음',
      parsed,
    };
  }

  const best = results.find((r) => r.confidence === 'high') ?? results[0];
  const status: IncomeMatchStatus = best.confidence === 'high' ? 'auto' : 'candidate';

  // 학습 저장
  if (name && best.contract_code) {
    history[name] = {
      contract_code: best.contract_code,
      car_number: best.car_number,
      contractor_name: best.contractor_name,
      car_hint: car || history[name]?.car_hint,
      last_date: date,
    };
    saveHistory(history);
  }

  return {
    status,
    category: '대여료',
    matches: results,
    best,
    reason:
      status === 'auto'
        ? `${best.contractor_name ?? ''} ${best.car_number ?? ''} ${best.bill_count ?? ''}회차`.trim()
        : `${best.contractor_name ?? ''} 후보 (금액 불일치)`.trim(),
    parsed,
  };
}

/* ─── 통합 매칭 (입금/출금 동시) ──────── */

export type MatchDirection = 'in' | 'out';
export type MatchStatus = IncomeMatchStatus | 'classified';

export interface MatchResult {
  status: MatchStatus;
  direction: MatchDirection;
  category: string;
  expenseType?: string;
  reason: string;
  best: IncomeMatchHit | null;
  matches: IncomeMatchHit[];
  parsed: ParsedCounterparty;
}

export function matchEvent(
  event: {
    direction?: MatchDirection | '입금' | '출금';
    counterparty?: unknown;
    amount?: number | string;
    summary?: unknown;
    memo?: unknown;
    date?: string;
  },
  ctx: IncomeContext,
): MatchResult {
  const dir = event.direction;
  const isOut = dir === 'out' || dir === '출금' || (!dir && Number(event.amount) < 0);

  if (isOut) {
    const text = `${event.counterparty ?? ''} ${event.summary ?? ''} ${event.memo ?? ''}`;
    const exp = classifyExpense(text);
    return {
      status: 'classified',
      direction: 'out',
      category: exp.category,
      expenseType: exp.type,
      reason: exp.category,
      parsed: parseCounterparty(event.counterparty),
      best: null,
      matches: [],
    };
  }

  const result = matchIncome(event, ctx);
  return { ...result, direction: 'in', best: result.best ?? null };
}

export function matchEvents<E extends { counterparty?: unknown; amount?: number | string }>(
  events: readonly E[],
  ctx: IncomeContext,
): { event: E; match: MatchResult }[] {
  return events.map((e) => ({ event: e, match: matchEvent(e, ctx) }));
}
