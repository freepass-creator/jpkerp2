/**
 * 엔티티 코드 자동 생성.
 * 형식: PREFIX-YYMMDD-XXXX (예: CUS-260420-A1B2)
 *
 * 모든 엔티티는 고유 코드를 가지며, 이 코드로 상호 연결.
 * 코드 체계:
 *   CUS  — 고객 (customer_code)
 *   CTR  — 계약 (contract_code)
 *   AST  — 자산 (asset_code)
 *   BIL  — 청구 (billing_code)
 *   EVT  — 이벤트 (event_code)
 *   INS  — 보험 (insurance_code)
 *   GPS  — GPS (gps_code)
 *   PTR  — 회원사 (partner_code)
 *   VND  — 거래처 (vendor_code)
 *   LON  — 할부 (loan_code)
 */

function rand4(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function dateStamp(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

export type CodePrefix =
  | 'CUS' | 'CTR' | 'AST' | 'BIL' | 'EVT'
  | 'INS' | 'GPS' | 'PTR' | 'VND' | 'LON';

export function generateCode(prefix: CodePrefix): string {
  return `${prefix}-${dateStamp()}-${rand4()}`;
}

/** 편의 함수 */
export const genCustomerCode = () => generateCode('CUS');
export const genContractCode = () => generateCode('CTR');
export const genAssetCode = () => generateCode('AST');
export const genBillingCode = () => generateCode('BIL');
export const genEventCode = () => generateCode('EVT');
export const genInsuranceCode = () => generateCode('INS');
export const genGpsCode = () => generateCode('GPS');
export const genPartnerCode = () => generateCode('PTR');
export const genVendorCode = () => generateCode('VND');
export const genLoanCode = () => generateCode('LON');
