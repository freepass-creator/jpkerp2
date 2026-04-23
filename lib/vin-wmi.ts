/**
 * VIN WMI (World Manufacturer Identifier) → 제조사 추론
 *
 * VIN 1~3자리는 ISO 3779 표준 제조사 코드.
 * 한국 차명에 제조사가 안 적혀있어도 VIN만 있으면 제조사 역추론 가능.
 */

// 3자리 WMI → 제조사 (한글 정규명)
const WMI_MAP: Record<string, string> = {
  // ── 현대 ──
  KMH: '현대', KMF: '현대', KME: '현대', KMJ: '현대', KMC: '현대',
  KM8: '현대', KNH: '현대', // 일부 구형
  // ── 기아 ──
  KNA: '기아', KNB: '기아', KNC: '기아', KND: '기아', KNE: '기아', KNG: '기아',
  // ── 제네시스 (신형 독립 브랜드) ──
  KMT: '제네시스',
  // ── 쌍용/KGM ──
  KPT: 'KGM', KPB: 'KGM', KPA: 'KGM',
  // ── 르노코리아 (구 르노삼성) ──
  KNM: '르노', VF1: '르노', VF6: '르노',
  // ── 쉐보레/GM ──
  KLA: '쉐보레', KLU: '쉐보레', KL1: '쉐보레', KL3: '쉐보레',
  KL4: '쉐보레', KL5: '쉐보레', KL6: '쉐보레', KL7: '쉐보레', KL8: '쉐보레',
  // ── BMW ──
  WBA: 'BMW', WBS: 'BMW', WBY: 'BMW', WBW: 'BMW',
  '4US': 'BMW', '5UX': 'BMW',
  // ── 벤츠 (Mercedes-Benz) ──
  WDB: '벤츠', WDD: '벤츠', WDC: '벤츠', WDF: '벤츠',
  W1K: '벤츠', W1N: '벤츠', W1V: '벤츠',
  // ── 아우디 ──
  WAU: '아우디', WA1: '아우디', TRU: '아우디',
  // ── 폭스바겐 ──
  WVW: '폭스바겐', WV1: '폭스바겐', WV2: '폭스바겐', WVG: '폭스바겐',
  // ── 포르쉐 ──
  WP0: '포르쉐', WP1: '포르쉐',
  // ── MINI ──
  WMW: '미니',
  // ── 테슬라 ──
  '5YJ': '테슬라', '7SA': '테슬라', LRW: '테슬라', XP7: '테슬라',
  // ── 볼보 ──
  YV1: '볼보', YV4: '볼보', LVS: '볼보', LYV: '볼보',
  // ── 토요타 ──
  JTD: '토요타', JTE: '토요타', JTH: '토요타', JTJ: '토요타', JTK: '토요타',
  JTL: '토요타', JTM: '토요타', JTN: '토요타', '4T1': '토요타', '4T3': '토요타',
  // ── 렉서스 ──
  JTH_LEX: '렉서스', // JTH도 토요타와 공유 — 모델로 구분 필요
  // ── 혼다 ──
  JHM: '혼다', JHL: '혼다', JHG: '혼다', '5FN': '혼다', '2HG': '혼다', '2HK': '혼다',
  // ── 닛산 ──
  JN1: '닛산', JN8: '닛산', '1N4': '닛산', '3N1': '닛산',
  // ── 마쓰다 ──
  JM1: '마쓰다', JM3: '마쓰다', '4F2': '마쓰다', '4F4': '마쓰다',
  // ── 포드 ──
  '1FA': '포드', '1FM': '포드', '1FT': '포드', '2FM': '포드', '3FA': '포드',
  // ── 지프/크라이슬러 (미국 + 유럽 생산) ──
  '1C4': '지프', '1J4': '지프', '1J8': '지프',
  ZAC: '지프', ZFB: '지프', // 유럽 생산 Jeep (이탈리아) — Avenger, Renegade 등
  '3C4': '크라이슬러', '2C4': '크라이슬러',
  // ── 캐딜락 ──
  '1G6': '캐딜락', '1GY': '캐딜락',
  // ── 랜드로버/재규어 ──
  SAL: '랜드로버', SAJ: '재규어',
  // ── 푸조/시트로엥 ──
  VF3: '푸조', VF7: '시트로엥',
  // ── 피아트/마세라티/페라리 ──
  ZFA: '피아트', ZAM: '마세라티', ZFF: '페라리',
};

/** VIN 1~3자리 WMI에서 제조사 추론. 못 찾으면 null. */
export function inferMakerFromVin(vin: string | null | undefined): string | null {
  if (!vin) return null;
  const clean = String(vin).trim().toUpperCase();
  if (clean.length < 3) return null;
  const wmi3 = clean.slice(0, 3);
  return WMI_MAP[wmi3] ?? null;
}
