/**
 * fuzzy-match — 문자열 퍼지 매칭 (V1 이식).
 *
 * Levenshtein distance + 정규화 + 부분문자열 우선.
 * 차종명·계약자명·회사명 등 OCR/CSV에서 들어오는 변종 표기 매칭에 사용.
 */

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m: number[][] = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] =
        b[i - 1] === a[j - 1]
          ? m[i - 1][j - 1]
          : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[b.length][a.length];
}

export interface FuzzyHit {
  value: string;
  score: number; // 0 = 완벽 일치, 0.5 이하만 매칭
}

/**
 * 후보 중 가장 유사한 1개. score ≤ threshold(기본 0.5)인 경우만 반환.
 */
export function fuzzyMatch(
  input: string,
  candidates: readonly string[],
  threshold = 0.5,
): FuzzyHit | null {
  if (!input || !candidates?.length) return null;
  const inN = norm(input);
  if (!inN) return null;

  // 정확 일치
  const exact = candidates.find((c) => norm(c) === inN);
  if (exact !== undefined) return { value: exact, score: 0 };

  // 부분 문자열 (양방향)
  for (const c of candidates) {
    const cN = norm(c);
    if (cN && (cN.includes(inN) || inN.includes(cN))) return { value: c, score: 0.01 };
  }

  // Levenshtein
  let best: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    if (!c) continue;
    const cN = norm(c);
    if (!cN) continue;
    const dist = levenshtein(inN, cN);
    const ratio = dist / Math.max(inN.length, cN.length);
    if (ratio < bestScore) {
      best = c;
      bestScore = ratio;
    }
  }
  return best !== null && bestScore <= threshold ? { value: best, score: bestScore } : null;
}

/**
 * 후보 중 유사한 상위 N개를 점수순으로 반환.
 */
export function fuzzyTop(
  input: string,
  candidates: readonly string[],
  n = 3,
  threshold = 0.6,
): FuzzyHit[] {
  if (!input || !candidates?.length) return [];
  const inN = norm(input);
  if (!inN) return [];
  return candidates
    .map((c): FuzzyHit => {
      const cN = norm(c);
      if (cN === inN) return { value: c, score: 0 };
      if (cN && (cN.includes(inN) || inN.includes(cN))) return { value: c, score: 0.01 };
      const dist = levenshtein(inN, cN);
      const len = Math.max(inN.length, cN.length || 1);
      return { value: c, score: dist / len };
    })
    .filter((r) => r.score <= threshold)
    .sort((a, b) => a.score - b.score)
    .slice(0, n);
}

/**
 * 회사명 정규화: '주식회사', '(주)', 공백/구두점 제거.
 * 회원사·거래처·고객사 매칭에 사용.
 */
export function normalizeCorpName(s: unknown): string {
  return String(s ?? '')
    .replace(/주식회사|유한회사|\(주\)|\(유\)|㈜|㈕|주\)|유\)/g, '')
    .replace(/[\s().,\-_]/g, '')
    .toLowerCase();
}

/**
 * 사업자번호/법인등록번호 매칭용 정규화: 숫자만 남김.
 */
export function normalizeBizNo(s: unknown): string {
  return String(s ?? '').replace(/\D/g, '');
}

/**
 * 차량번호 정규화: 공백 제거.
 */
export function normalizeCarNumber(s: unknown): string {
  return String(s ?? '').replace(/\s+/g, '');
}
