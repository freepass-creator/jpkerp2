export type DevKey = 'rtdb' | 'carmaster' | 'bulk-delivery' | 'overdue' | 'cutover' | 'alimtalk' | 'sms' | 'data-purge' | 'mobile-inbox';

export const DEV_LABELS: Record<DevKey, string> = {
  rtdb: 'RTDB 현황',
  carmaster: '차종 마스터',
  'bulk-delivery': '일괄 출고',
  overdue: '개별 미수',
  cutover: '미수 정산 검증',
  alimtalk: '알림톡',
  sms: 'SMS',
  'data-purge': '데이터 삭제',
  'mobile-inbox': '모바일 업로드함',
};

export const DEV_SUBS: Record<DevKey, string> = {
  rtdb: '컬렉션별 레코드 수·용량',
  carmaster: '차종 마스터 관리 — 추가·수정·삭제',
  'bulk-delivery': '계약 출고 대상 차량 · 회원사',
  overdue: '미수 건별 수기 매칭',
  cutover: 'billing ↔ event 매칭 검증',
  alimtalk: '카카오 알림톡 발송 이력',
  sms: 'SMS 발송 이력',
  'data-purge': '마스터·이벤트 데이터 일괄 삭제',
  'mobile-inbox': '모바일에서 업로드된 사진 검토·정식 DB 반영',
};

export const DEV_ICONS: Record<DevKey, string> = {
  rtdb: 'ph-database',
  carmaster: 'ph-car',
  'bulk-delivery': 'ph-truck',
  overdue: 'ph-magnifying-glass',
  cutover: 'ph-currency-krw',
  alimtalk: 'ph-chat-text',
  sms: 'ph-envelope',
  'data-purge': 'ph-trash',
  'mobile-inbox': 'ph-device-mobile',
};
