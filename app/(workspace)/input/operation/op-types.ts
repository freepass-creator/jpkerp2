export type OpKey =
  | 'ioc'
  | 'pc'
  | 'contact'
  | 'accident'
  | 'ignition'
  | 'insurance'
  | 'product_register'
  | 'penalty_notice'
  | 'disposal'
  // 히든 (pc 또는 다른 경로로 접근)
  | 'maint'
  | 'repair'
  | 'product'
  | 'wash'
  | 'fuel'
  | 'penalty'
  | 'collect'
  | 'key';

export const OP_LABELS: Record<OpKey, string> = {
  ioc: '입출고센터',
  pc: '차량케어센터',
  contact: '고객센터',
  accident: '사고접수',
  ignition: '시동제어',
  insurance: '보험관리',
  product_register: '상품등록',
  penalty_notice: '과태료작업',
  disposal: '자산처분',

  maint: '정비',
  repair: '사고수리',
  product: '상품화',
  wash: '세차',
  fuel: '연료보충',
  penalty: '과태료 변경부과',
  collect: '미수관리',
  key: '차키 전달/분출',
};

export const OP_SUBS: Record<OpKey, string> = {
  ioc: '출고·반납·강제회수·차량이동',
  pc: '정비·사고수리·상품화·세차 통합',
  contact: '통화/상담/컴플레인/문의',
  accident: '사고 발생/보험접수',
  ignition: '시동제어·회수결정·회수진행',
  insurance: '연령변경·갱신·신규·해지',
  product_register: '휴차 → 상품대기 등록 · 대여조건',
  penalty_notice: '고지서 OCR · 확인서 병합 다운로드',
  disposal: '매각·폐차·반환·전손 · 차량 생애종료',

  maint: '소모품교체 + 기능수리',
  repair: '판금/도색/수리',
  product: '반납 후 재상품화',
  wash: '세차/실내크리닝',
  fuel: '주유/전기충전',
  penalty: '과태료 임차인 변경부과',
  collect: '독촉/내용증명/법적조치',
  key: '키 전달/회수/분실',
};
