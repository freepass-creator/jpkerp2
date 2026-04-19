import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmt = (n: number | null | undefined): string => {
  if (n == null || Number.isNaN(n)) return '-';
  return Number(n).toLocaleString('ko-KR');
};

export const fmtDate = (s: string | null | undefined): string => {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1].slice(2)}.${m[2]}.${m[3]}` : s;
};
