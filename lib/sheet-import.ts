/**
 * sheet-import — 구글시트 공개 링크 → CSV export 가져오기.
 *
 * 사용:
 *   const text = await fetchGoogleSheet('https://docs.google.com/spreadsheets/d/{id}/edit#gid=0');
 *   const rows = parseCsv(text);
 *
 * 시트는 '링크가 있는 모든 사용자: 뷰어' 권한이어야 함.
 * 비공개 시트면 HTML이 반환되어 'CSV 변환 실패' 처리.
 */

export interface SheetRef {
  id: string;
  gid: string;
}

export function parseSheetUrl(url: string): SheetRef | null {
  const m = String(url ?? '').match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const g = url.match(/[#?&]gid=(\d+)/);
  return { id: m[1], gid: g ? g[1] : '0' };
}

export async function fetchGoogleSheet(url: string): Promise<string> {
  const ref = parseSheetUrl(url);
  if (!ref) throw new Error('올바른 구글 시트 URL이 아닙니다');
  const exportUrl = `https://docs.google.com/spreadsheets/d/${ref.id}/export?format=csv&gid=${ref.gid}`;
  const res = await fetch(exportUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status} — 시트 접근 실패`);
  const text = await res.text();
  if (text.trim().startsWith('<')) {
    throw new Error('시트가 비공개입니다 — 공유 → 링크가 있는 모든 사용자: 뷰어');
  }
  return text;
}
