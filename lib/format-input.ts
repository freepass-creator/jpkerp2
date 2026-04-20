/**
 * 한국형 입력 포맷 헬퍼 — 직원 입력 번거로움 최소화.
 * 모두 "입력 도중에도 허용"되는 진행형 파서 (partial-safe).
 */

/** 차량번호: 공백 제거 + 최대 8자 */
export function sanitizeCarNumber(input: string): string {
  return (input ?? '').replace(/\s/g, '').slice(0, 8);
}

/**
 * 전화번호 포맷 — 숫자만 추출 후 `-` 자동.
 * - 010/011/016/017/018/019 → 3-4-4 (휴대폰 11자리) 또는 3-3-4 (10자리)
 * - 02 → 2-3-4 / 2-4-4
 * - 070 / 지역번호(031, 032, ...) → 3-3-4 / 3-4-4
 */
export function formatPhone(input: string): string {
  const d = (input ?? '').replace(/\D/g, '').slice(0, 11);
  if (!d) return '';

  // 02 (서울)
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }

  // 3자리 국번 (010, 011, 070, 031~064 등)
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}

/** 사업자등록번호 — 10자리, 3-2-5 */
export function formatBizRegNo(input: string): string {
  const d = (input ?? '').replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** 주민등록번호 / 법인등록번호 — 13자리, 6-7 */
export function formatResRegNo(input: string): string {
  const d = (input ?? '').replace(/\D/g, '').slice(0, 13);
  if (d.length <= 6) return d;
  return `${d.slice(0, 6)}-${d.slice(6)}`;
}

/** 금액 — 숫자만 남기고 천단위 콤마 (0은 빈 문자열) */
export function formatAmount(input: string | number): string {
  const n = Number(String(input ?? '').replace(/[^\d-]/g, ''));
  if (!Number.isFinite(n) || n === 0) return '';
  return n.toLocaleString();
}

/** 금액 역파싱 (콤마 제거 → number) */
export function parseAmount(input: string): number {
  const n = Number(String(input ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}
