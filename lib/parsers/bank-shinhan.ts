/**
 * 신한은행 거래내역 CSV 파서 — jpkerp shinhan.js 이식.
 *
 * 컬럼 (인터넷뱅킹 다운로드 기준):
 *   No, 전체선택, 거래일시, 적요, 입금액, 출금액, 내용, 잔액, 거래점명, 입금인코드, 메모
 */

export interface BankTxEvent {
  type: 'bank_tx';
  source: 'bank_shinhan';
  date: string;
  direction: 'in' | 'out';
  amount: number;
  counterparty: string;
  summary: string;
  balance: number;
  memo: string;
  branch: string;
  raw_key: string;
  account?: string;
  account_no?: string;
}

const REQUIRED = ['거래일시', '입금액', '출금액', '내용'];
export const LABEL = '신한은행';

export function detect(headers: string[]): boolean {
  if (!Array.isArray(headers)) return false;
  return REQUIRED.every((c) => headers.some((h) => String(h || '').trim() === c));
}

const num = (v: unknown): number => {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/[,\s]/g, ''));
  return isNaN(n) ? 0 : n;
};

const parseDate = (s: unknown): string => {
  const m = String(s || '').match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return '';
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
};

export function parseRow(row: string[], headers: string[]): BankTxEvent | null {
  const idx = (name: string) => headers.indexOf(name);
  const date = parseDate(row[idx('거래일시')]);
  if (!date) return null;
  const inAmt = num(row[idx('입금액')]);
  const outAmt = num(row[idx('출금액')]);
  if (!inAmt && !outAmt) return null;
  const direction: 'in' | 'out' = inAmt > 0 ? 'in' : 'out';
  const amount = inAmt || outAmt;
  const content = String(row[idx('내용')] || '').trim();
  const summary = String(row[idx('적요')] || '').trim();
  const balance = num(row[idx('잔액')]);
  const memo = String(row[idx('메모')] || '').trim();
  const branch = String(row[idx('거래점명')] || '').trim();

  return {
    type: 'bank_tx',
    source: 'bank_shinhan',
    date,
    direction,
    amount,
    counterparty: content,
    summary,
    balance,
    memo,
    branch,
    raw_key: `${date}|${direction}|${amount}|${content}|${balance}`,
  };
}
