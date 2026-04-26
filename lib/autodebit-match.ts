/**
 * autodebit-match — 자동이체 ↔ 통장 입금 매칭 (V1 이식).
 *
 * 입력:
 *   - autodebits: 등록된 자동이체 목록 (계약/고객/금액/매월 출금일)
 *   - bankTxns:   통장 거래 (입금)
 * 출력: 매칭 결과 [{ autodebit, transaction, status, score, scheduled_date }]
 *
 * 매칭 방식:
 *   1. 이번달 예정일 기준 ±5일~+14일 범위 (연휴/주말 고려)
 *   2. 금액: 등록금액 - 수수료(최대 1,500원) 까지 허용
 *   3. 이름 일치 / 부분 일치 가산
 *   4. 점수 5점 이상 → 매칭 후보, 7점 이상 → auto
 *
 * CMS 합산 입금:
 *   findCMSSubset — 입금액과 일치하는 자동이체 조합 탐색 (subset sum).
 *   N≤20: 완전 탐색 / N>20: 그리디.
 */

const DAY_MS = 86_400_000;
const AUTO_DEBIT_KEYWORDS = /자동이체|CMS|카드자동|집금/i;

export interface AutoDebitRecord {
  contract_code?: string;
  customer_name?: string;
  amount?: number | string;
  /** 매월 출금일 (1~31) 또는 '말일' */
  debit_day?: number | string;
  status?: string;
  [k: string]: unknown;
}

export interface BankTxn {
  date?: string;
  amount?: number | string;
  direction?: 'in' | 'out' | '입금' | '출금';
  counterparty?: string;
  summary?: string;
  memo?: string;
  event_id?: string;
  raw_key?: string;
  [k: string]: unknown;
}

export type AutoDebitMatchStatus =
  | 'matched' // score ≥ 7 — 자동 확정
  | 'candidate' // score 5~6 — 확인 필요
  | 'pending' // 예정일 미도래
  | 'overdue' // 예정일 +5일 경과 + 매칭 실패
  | 'unregistered'; // 입금은 있는데 등록된 자동이체 없음

export interface AutoDebitMatchResult {
  autodebit: AutoDebitRecord | null;
  transaction: BankTxn | null;
  scheduled_date?: string;
  actual_date?: string | null;
  status: AutoDebitMatchStatus;
  score?: number;
}

function txnId(t: BankTxn): string {
  return t.event_id ?? t.raw_key ?? `${t.date ?? ''}_${t.amount ?? ''}_${t.counterparty ?? ''}`;
}

function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isIncoming(t: BankTxn): boolean {
  return t.direction === 'in' || t.direction === '입금';
}

/**
 * 매칭 실행. referenceDate 기준 이번달 자동이체와 입금 매칭.
 */
export function matchAutoDebits(
  autodebits: readonly AutoDebitRecord[],
  bankTxns: readonly BankTxn[],
  referenceDate: Date = new Date(),
): AutoDebitMatchResult[] {
  const refYm = referenceDate.toISOString().slice(0, 7);
  const results: AutoDebitMatchResult[] = [];

  // 입금 → 자동이체 키워드 포함만
  const incoming = bankTxns.filter(isIncoming);
  const autoIncoming = incoming.filter((t) =>
    AUTO_DEBIT_KEYWORDS.test(`${t.summary ?? ''} ${t.counterparty ?? ''} ${t.memo ?? ''}`),
  );

  // 이번달 활성 자동이체
  const activeDebits = autodebits.filter(
    (d) => d.status === '사용중' || d.status === '등록' || !d.status,
  );
  const usedTxnIds = new Set<string>();

  for (const debit of activeDebits) {
    const debitDay = debit.debit_day === '말일' ? daysInMonth(refYm) : Number(debit.debit_day);
    if (!debitDay) continue;

    const scheduledDate = new Date(`${refYm}-${String(debitDay).padStart(2, '0')}T00:00:00`);
    const rangeFrom = scheduledDate.getTime() - 5 * DAY_MS;
    const rangeTo = scheduledDate.getTime() + 14 * DAY_MS;

    const candidates = autoIncoming.filter((t) => {
      if (usedTxnIds.has(txnId(t))) return false;
      const tMs = t.date ? new Date(t.date).getTime() : Number.NaN;
      if (!Number.isFinite(tMs)) return false;
      return tMs >= rangeFrom && tMs <= rangeTo;
    });

    let best: BankTxn | null = null;
    let bestScore = 0;
    const debitAmount = Number(debit.amount) || 0;

    for (const c of candidates) {
      let score = 0;
      const cAmount = Number(c.amount) || 0;
      const diff = debitAmount - cAmount;

      // 금액: 입금은 수수료(건당 200~1,500원) 차감되어 들어옴
      if (diff === 0) score += 5;
      else if (diff > 0 && diff <= 1500) score += 5;
      else if (diff > 0 && diff <= 3000) score += 4;
      else continue;

      // 이름
      const cName = String(c.counterparty ?? '').trim();
      const dName = String(debit.customer_name ?? '').trim();
      if (cName && dName) {
        if (cName === dName) score += 3;
        else if (cName.includes(dName) || dName.includes(cName)) score += 2;
      }

      // 날짜 근접도
      const tMs = c.date ? new Date(c.date).getTime() : Number.NaN;
      const dayDiff = Number.isFinite(tMs)
        ? Math.abs(Math.round((tMs - scheduledDate.getTime()) / DAY_MS))
        : 99;
      if (dayDiff === 0) score += 2;
      else if (dayDiff <= 2) score += 1;

      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    const pastDue = referenceDate.getTime() > rangeTo;

    if (best && bestScore >= 5) {
      usedTxnIds.add(txnId(best));
      results.push({
        autodebit: debit,
        transaction: best,
        scheduled_date: isoDate(scheduledDate),
        actual_date: best.date ?? null,
        status: bestScore >= 7 ? 'matched' : 'candidate',
        score: bestScore,
      });
    } else {
      results.push({
        autodebit: debit,
        transaction: null,
        scheduled_date: isoDate(scheduledDate),
        actual_date: null,
        status: pastDue ? 'overdue' : 'pending',
      });
    }
  }

  // 미매칭 입금 (등록되지 않은 자동이체 입금)
  for (const t of autoIncoming) {
    if (!usedTxnIds.has(txnId(t))) {
      results.push({ autodebit: null, transaction: t, status: 'unregistered' });
    }
  }

  return results;
}

/* ─── CMS 합산 입금 매칭 (subset sum) ───────────────────── */

export interface CMSSubsetResult {
  debits: AutoDebitRecord[];
  totalFee: number;
  matched: boolean;
}

/**
 * CMS 합산 입금 → 자동이체 조합 탐색.
 * @param feePerItem 건당 수수료 (기본 500원)
 */
export function findCMSSubset(
  candidates: readonly AutoDebitRecord[],
  depositAmount: number,
  feePerItem = 500,
): CMSSubsetResult | null {
  if (!candidates.length || !depositAmount) return null;

  // ① 전체 매칭 우선
  const allSum = candidates.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const allFee = candidates.length * feePerItem;
  if (Math.abs(allSum - allFee - depositAmount) <= 500) {
    return { debits: [...candidates], totalFee: allFee, matched: true };
  }

  // ② 부분 조합
  if (candidates.length <= 20) {
    return subsetSumExact(candidates, depositAmount, feePerItem);
  }
  return subsetSumGreedy(candidates, depositAmount, feePerItem);
}

function subsetSumExact(
  items: readonly AutoDebitRecord[],
  target: number,
  feePerItem: number,
): CMSSubsetResult | null {
  const n = items.length;
  let bestSubset: AutoDebitRecord[] | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let mask = 1; mask < 1 << n; mask++) {
    const subset: AutoDebitRecord[] = [];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        subset.push(items[i]);
        sum += Number(items[i].amount) || 0;
      }
    }
    const fee = subset.length * feePerItem;
    const diff = Math.abs(sum - fee - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSubset = subset;
      if (diff === 0) break;
    }
  }
  if (bestSubset && bestDiff <= 500) {
    return {
      debits: bestSubset,
      totalFee: bestSubset.length * feePerItem,
      matched: true,
    };
  }
  return null;
}

function subsetSumGreedy(
  items: readonly AutoDebitRecord[],
  target: number,
  feePerItem: number,
): CMSSubsetResult | null {
  const sorted = [...items].sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
  const chosen: AutoDebitRecord[] = [];
  let sum = 0;
  for (const item of sorted) {
    const itemAmt = Number(item.amount) || 0;
    const newSum = sum + itemAmt;
    const newFee = (chosen.length + 1) * feePerItem;
    if (newSum - newFee <= target + 500) {
      chosen.push(item);
      sum = newSum;
      if (Math.abs(sum - newFee - target) <= 500) break;
    }
  }
  const fee = chosen.length * feePerItem;
  if (Math.abs(sum - fee - target) <= 500) {
    return { debits: chosen, totalFee: fee, matched: true };
  }
  return null;
}
