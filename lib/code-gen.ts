/**
 * 엔티티 코드 자동 생성.
 * 형식: XX + 순번 (자릿수는 엔티티별)
 *
 * 코드 체계:
 *   CU — 고객 (customer_code) — CU00001 (5자리)
 *   CT — 계약 (contract_code) — CT00001 (5자리)
 *   AS — 자산 (asset_code) — AS00001 (5자리)
 *   BL — 청구 (billing_code) — BL00001 (5자리)
 *   EV — 이벤트 (event_code) — EV00001 (5자리)
 *   IN — 보험 (insurance_code) — IN00001 (5자리)
 *   GP — GPS (gps_code) — GP00001 (5자리)
 *   CP — 회사 (partner_code) — CP01 (2자리, 99까지)  ← 회사는 많지 않으므로
 *   VD — 거래처 (vendor_code) — VD00001 (5자리)
 *   LN — 할부 (loan_code) — LN00001 (5자리)
 */

// 순번 카운터 (메모리 내, 앱 재시작 시 타임스탬프 기반 리셋)
const counters = new Map<string, number>();

function nextSeq(prefix: string): number {
  const cur = counters.get(prefix) ?? Math.floor(Date.now() % 100000);
  const next = cur + 1;
  counters.set(prefix, next);
  return next;
}

export type CodePrefix =
  | 'CU' | 'CT' | 'AS' | 'BL' | 'EV'
  | 'IN' | 'GP' | 'CP' | 'VD' | 'LN';

// 회사(CP)는 2자리, 나머지는 5자리
const PAD_DIGITS: Record<CodePrefix, number> = {
  CU: 5, CT: 5, AS: 5, BL: 5, EV: 5,
  IN: 5, GP: 5, VD: 5, LN: 5,
  CP: 2, // 회사는 99까지만
};

export function generateCode(prefix: CodePrefix): string {
  const seq = nextSeq(prefix);
  return `${prefix}${String(seq).padStart(PAD_DIGITS[prefix], '0')}`;
}

/** 편의 함수 */
export const genCustomerCode = () => generateCode('CU');
export const genContractCode = () => generateCode('CT');
export const genAssetCode = () => generateCode('AS');
export const genBillingCode = () => generateCode('BL');
export const genEventCode = () => generateCode('EV');
export const genInsuranceCode = () => generateCode('IN');
export const genGpsCode = () => generateCode('GP');
export const genPartnerCode = () => generateCode('CP');
export const genVendorCode = () => generateCode('VD');
export const genLoanCode = () => generateCode('LN');

// ───────── RTDB 기반 안전한 코드 생성 ─────────
// 메모리 카운터는 앱 재시작 시 충돌 위험. 실제 RTDB의 최대 코드를 조회해서 +1.

/**
 * 주어진 컬렉션에서 {prefix}#### 패턴 중 최대값을 찾아 다음 코드 반환.
 * 예: partners 컬렉션의 partner_code 필드에서 PT00042까지 있으면 PT00043 반환.
 *
 * 동시성 주의: 동시에 여러 클라이언트가 호출하면 같은 코드 생성 가능.
 * 대량 동시 업로드가 아닌 일반 사용에서는 충분히 안전.
 */
export async function generateNextCode(
  collectionPath: string,
  codeField: string,
  prefix: CodePrefix,
): Promise<string> {
  const { ref, get } = await import('firebase/database');
  const { getRtdb } = await import('@/lib/firebase/rtdb');
  const snap = await get(ref(getRtdb(), collectionPath));
  let maxSeq = 0;
  if (snap.exists()) {
    const raw = snap.val() as Record<string, Record<string, unknown>>;
    for (const v of Object.values(raw)) {
      const code = v?.[codeField];
      if (typeof code !== 'string') continue;
      const m = code.match(new RegExp(`^${prefix}(\\d+)$`));
      if (m) {
        const n = Number(m[1]);
        if (n > maxSeq) maxSeq = n;
      }
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(PAD_DIGITS[prefix], '0')}`;
}

export const nextPartnerCode = () => generateNextCode('partners', 'partner_code', 'CP');
export const nextCustomerCode = () => generateNextCode('customers', 'customer_code', 'CU');
export const nextAssetCode = () => generateNextCode('assets', 'asset_code', 'AS');
export const nextContractCode = () => generateNextCode('contracts', 'contract_code', 'CT');
export const nextVendorCode = () => generateNextCode('vendors', 'vendor_code', 'VD');
export const nextLoanCode = () => generateNextCode('loans', 'loan_code', 'LN');
export const nextInsuranceCode = () => generateNextCode('insurances', 'insurance_code', 'IN');
export const nextGpsCode = () => generateNextCode('gps_devices', 'gps_code', 'GP');
