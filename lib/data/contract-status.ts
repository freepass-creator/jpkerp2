/**
 * 계약 lifecycle 상태 · 자산 상태 · 전이 맵.
 * RTDB의 contract_status · asset_status 필드에 사용.
 */

export type ContractStatusKo = '계약대기' | '계약진행' | '계약완료' | '계약해지';

export const CONTRACT_STATUSES: ContractStatusKo[] = [
  '계약대기',
  '계약진행',
  '계약완료',
  '계약해지',
];

/** 진행 중(활성) 계약 판정 — 종료/해지가 아니면 진행 중으로 간주 */
export function isActiveContractStatus(s?: string | null): boolean {
  if (!s) return true;
  return s !== '계약완료' && s !== '계약해지';
}

/** 자산 생애 상태 — assets.asset_status */
export type AssetLifecycleKo =
  | '가동중'     // 활성 계약 출고 중
  | '휴차'       // 계약 없음, 재출고 대기
  | '정비중'     // PC/정비 입고 중
  | '상품화대기' // 반납 후 상품 등록 대기
  | '상품';       // freepass 상품 등록됨
export const ASSET_LIFECYCLES: AssetLifecycleKo[] = ['가동중', '휴차', '정비중', '상품화대기', '상품'];

/**
 * IocForm 반납 시 next_plan(사용자 선택) → 이벤트 후 자산 상태로 변환.
 * '재출고'는 고객 교체가 아직 결정 안 된 상태라 휴차로 취급.
 */
export const NEXT_PLAN_TO_ASSET_STATUS: Record<string, AssetLifecycleKo> = {
  재출고: '휴차',
  정비입고: '정비중',
  상품화: '상품화대기',
  매각: '상품화대기',
};

/**
 * 반납/회수 시 계약 종료 유형.
 *   정상반납  → 계약완료
 *   강제회수  → 계약해지
 *   만기도래  → 계약완료
 */
export type ContractCloseKind = '정상반납' | '강제회수' | '만기종료';
export const CONTRACT_CLOSE_STATUS: Record<ContractCloseKind, ContractStatusKo> = {
  정상반납: '계약완료',
  강제회수: '계약해지',
  만기종료: '계약완료',
};
