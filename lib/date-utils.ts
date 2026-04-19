/**
 * 기존 jpkerp date/contract 계산 로직 이식
 */

export function normalizeDate(s?: string | null): string {
  if (!s) return '';
  let v = String(s).trim().replace(/[./]/g, '-');
  const m = v.match(/^(\d{2})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const yy = Number(m[1]);
    v = `${yy < 50 ? 2000 + yy : 1900 + yy}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  return v;
}

export function computeContractEnd(c: {
  end_date?: string;
  start_date?: string;
  rent_months?: number | string;
}): string {
  if (c.end_date) return normalizeDate(c.end_date);
  const start = normalizeDate(c.start_date);
  if (!start || !c.rent_months) return '';
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + Number(c.rent_months));
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** YYYY-MM-DD → YY.MM.DD (공간 절약용 표기). 없으면 '—'. */
export function shortDate(s?: string | null): string {
  if (!s) return '—';
  const m = String(s).match(/^(\d{2,4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return String(s);
  const yy = m[1].length === 4 ? m[1].slice(2) : m[1];
  return `${yy}.${m[2].padStart(2, '0')}.${m[3].padStart(2, '0')}`;
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 0;
  return Math.floor((db.getTime() - da.getTime()) / 86400000);
}

/** 계약이 "활성" 상태인지 (오늘이 start~end 사이) */
export function isActiveContract(
  c: { start_date?: string; end_date?: string; rent_months?: number | string; contractor_name?: string; status?: string },
  t: string = today(),
): boolean {
  if (c.status === 'deleted') return false;
  if (!c.contractor_name || !String(c.contractor_name).trim()) return false;
  const s = normalizeDate(c.start_date);
  if (!s || s > t) return false;
  const e = computeContractEnd(c);
  return !e || e >= t;
}

/** 청구액 합 (installments 있으면 그 합, 없으면 amount) */
export function computeTotalDue(b: {
  amount?: number;
  installments?: { amount?: number }[];
}): number {
  if (b.installments && Array.isArray(b.installments)) {
    return b.installments.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  }
  return Number(b.amount) || 0;
}
