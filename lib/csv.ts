/**
 * CSV 파서 — PapaParse 래퍼.
 * UTF-8 BOM·따옴표·이스케이프·다양한 개행 모두 PapaParse가 처리.
 */
import Papa from 'papaparse';

/** 2차원 배열 (헤더 미분리) */
export function parseCsv(text: string): string[][] {
  const res = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });
  return (res.data ?? []).filter((r) => r.some((c) => String(c).trim() !== ''));
}

/** 헤더 기준 객체 배열 */
export function parseCsvObjects(text: string): Array<Record<string, string>> {
  const res = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === 'string' ? v.trim() : v),
  });
  return (res.data ?? []).filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''));
}
