# JPK ERP v2 — Data Model

작성: 2026-04-17
스토어: **Cloud Firestore** (기존 RTDB에서 이주)

## 1. 컬렉션 개요

```
users/{uid}                      직원
partners/{partner_code}          회원사 (관리코드)
customers/{customer_id}          고객
assets/{asset_id}                차량 (생애주기 주인공)
contracts/{contract_code}        계약
billings/{billing_id}            회차 청구·입금
events/{event_id}                운영 이벤트 (17종, 기존 계승)
comments/{comment_id}            메모·멘션
audit_logs/{log_id}              자동 감사 로그
notifications/{notif_id}         알림 센터
drafts/{draft_id}                폼 draft (자동저장)
sync_logs/{log_id}               freepasserp 동기화 기록
```

## 2. 주요 엔티티

### 2.1. users
```ts
{
  uid: string                    // Firebase Auth UID
  email: string
  name: string
  phone?: string
  role: 'admin' | 'manager' | 'operator' | 'viewer'
  assigned_partners: string[]    // 접근 가능한 partner_code 목록 (admin은 무관)
  active: boolean
  created_at: Timestamp
  updated_at: Timestamp
}
```

### 2.2. partners (회원사)
```ts
{
  partner_code: string           // PK (관리코드)
  name: string
  business_no?: string           // 사업자등록번호
  contact_name?: string
  contact_phone?: string
  address?: string
  default_assignee_uid?: string  // 해당 회원사 신규 계약의 기본 담당자
  active: boolean
  created_at: Timestamp
  updated_at: Timestamp
}
```

### 2.3. customers (고객)
```ts
{
  customer_id: string            // PK (UUID)
  partner_code: string
  name: string
  phone: string
  birth?: string                 // YYYY-MM-DD
  address?: string
  license_no?: string
  license_expiry?: string
  employer?: string
  note?: string
  contracts: string[]            // 이 고객의 contract_code 목록 (역참조 편의)
  created_at: Timestamp
  updated_at: Timestamp
}
```

### 2.4. assets (차량) — 생애주기 주인공
```ts
{
  asset_id: string               // PK
  partner_code: string
  car_number: string             // 차량번호 (unique per partner)
  vin?: string                   // 차대번호
  manufacturer: string           // 제조사
  model: string                  // 모델
  detail_model?: string          // 세부모델
  trim?: string
  car_year?: number
  fuel_type?: string
  ext_color?: string
  int_color?: string
  first_registration_date?: string

  // 생애주기
  lifecycle_stage:
    | 'acquired'                 // 취득
    | 'marketing'                // 영업 (freepasserp 상품 등록)
    | 'contracted'               // 계약 완료, 출고 대기
    | 'delivered'                // 출고 완료
    | 'operating'                // 운영중
    | 'expiring'                 // 만기 임박 (auto, 30일 이내)
    | 'returned'                 // 반납 완료
    | 'disposed'                 // 매각
    | 'renewed'                  // 연장 운행중

  // 담당자 (계약 없을 때만 의미)
  primary_assignee_uid?: string

  // 운영 지표 (Cloud Function으로 주기 갱신)
  current_mileage?: number
  last_maint_date?: string

  // 할부
  loan?: {
    company: string
    principal: number
    interest_rate?: number
    term_months: number
    start_date: string
    monthly_payment: number
    paid_months: number
    balance: number
  }

  // 취득·매각 정보
  acquired_at?: Timestamp
  acquisition_cost?: number
  disposed_at?: Timestamp
  disposal_price?: number

  created_at: Timestamp
  updated_at: Timestamp
  status: 'active' | 'deleted'
}
```

### 2.5. contracts (계약)
```ts
{
  contract_code: string          // PK (C20260417001 형식)
  partner_code: string
  asset_id: string               // 차량 참조
  customer_id: string            // 고객 참조
  primary_assignee_uid: string   // 담당 직원

  contract_status:
    | 'draft'                    // 초안 (freepasserp 동기화 직후)
    | '계약진행'                  // 운영중
    | '계약종료'                  // 정상 종료
    | '계약해지'                  // 중도 해지

  start_date: string             // YYYY-MM-DD
  end_date?: string              // 없으면 start+rent_months로 계산
  rent_months: number
  rent_amount: number            // 월 렌트료
  deposit?: number               // 보증금
  auto_debit_day?: number        // 자동이체일 (1~31)

  // 연장·재계약 체인
  original_contract_id?: string  // 이전 계약 (연장/재계약이면)
  is_extension: boolean          // true면 연장운행
  is_renewal: boolean            // true면 재계약 (고객·차량 다시 선택)

  // freepasserp 동기화
  sync_status:
    | 'pending_review'           // 동기화 직후 검토 대기
    | 'active'                   // 관리자 승인 완료
    | 'closed'                   // 종료
  freepasserp_contract_id?: string

  // 계약서·문서
  contract_doc_urls: string[]
  insurance_doc_urls?: string[]

  created_at: Timestamp
  updated_at: Timestamp
  status: 'active' | 'deleted'
}
```

### 2.6. billings (회차)
```ts
{
  billing_id: string             // PK
  contract_code: string
  partner_code: string
  asset_id: string

  bill_number: number            // 회차 번호
  due_date: string               // 납부 예정일
  amount: number                 // 청구액 (= rent_amount + 부가)
  paid_total: number             // 누적 입금액
  paid_events: {                 // 입금 상세
    event_id: string             // events 참조
    paid_at: string
    amount: number
    method?: string              // 이체·카드·현금
  }[]

  status: '청구대기' | '청구완료' | '부분입금' | '완납' | '연체' | '납부대기' | '면제'
  overdue_days?: number          // 자동 계산 (Cloud Function)

  created_at: Timestamp
  updated_at: Timestamp
}
```

### 2.7. events (운영 이벤트, 17종)
기존 jpkerp events 컬렉션 계승.

```ts
type EventType =
  | 'contact'      // 고객센터 응대
  | 'delivery'     // 출고
  | 'return'       // 반납
  | 'force'        // 강제 회수
  | 'transfer'     // 차량 이동
  | 'key'          // 키 교체
  | 'maint'        // 정비
  | 'maintenance'  // 정비 (alias)
  | 'accident'     // 사고
  | 'repair'       // 수리
  | 'penalty'      // 과태료
  | 'product'      // 상품화 작업
  | 'insurance'    // 보험 가입·갱신
  | 'collect'      // 미수 조치
  | 'wash'         // 세차
  | 'fuel'         // 주유
  | 'bank_tx'      // 통장 거래
  | 'card_tx'      // 카드 거래

interface EventBase {
  event_id: string
  partner_code: string
  asset_id?: string              // 차량 관련 (bank_tx/card_tx는 없을 수도)
  contract_code?: string
  type: EventType
  date: string                   // YYYY-MM-DD
  title?: string
  amount?: number
  vendor?: string
  handler_uid: string            // 이 이벤트를 기록한 직원
  memo?: string
  photo_urls?: string[]
  doc_urls?: string[]
  created_at: Timestamp
  updated_at: Timestamp
  status: 'active' | 'deleted'
}

// type별 서브필드 (대표)
// accident
  accident_status: '진행중' | '수리대기' | '수리중' | '종결' | '완료' | '처리완료'
  fault_ratio?: number
  other_party?: { name: string, phone: string, insurance_co: string }

// maint / repair / wash / product
  work_status: '진행중' | '작업중' | '완료'
  mileage?: number

// contact
  contact_result: '응대완료' | '진행중' | '보류' | '처리불가'
  contact_channel: '전화' | '문자' | '카톡' | '방문' | '기타'

// collect
  collect_result: '즉시납부' | '납부약속' | '연락불가' | '거부'
  promise_date?: string

// delivery / return
  from_location?: string
  to_location?: string

// bank_tx / card_tx
  match_status: 'unmatched' | 'candidate' | 'matched' | 'ignored'
  matched_billing_id?: string
```

### 2.8. comments (메모·멘션)
```ts
{
  comment_id: string
  entity_type: 'asset' | 'contract' | 'customer' | 'event'
  entity_id: string
  author_uid: string
  body: string                   // 마크다운 일부 지원
  mentions: string[]             // uid 목록
  parent_comment_id?: string     // 스레드
  created_at: Timestamp
  edited_at?: Timestamp
  deleted_at?: Timestamp
}
```

### 2.9. audit_logs (자동 감사로그)
```ts
{
  log_id: string
  entity_type: string
  entity_id: string
  actor_uid: string
  action: 'create' | 'update' | 'delete' | 'restore'
  field?: string                 // 변경된 필드 (update인 경우)
  before?: any
  after?: any
  at: Timestamp
}
```

Cloud Function으로 `onWrite` 트리거 시 자동 기록.

### 2.10. notifications (알림 센터)
```ts
{
  notif_id: string
  recipient_uid: string
  type:
    | 'mention'
    | 'assigned'
    | 'overdue_alert'
    | 'contract_expiring'
    | 'sync_pending_review'
    | 'task_due'
  title: string
  body?: string
  entity_ref?: { type: string, id: string }
  read_at?: Timestamp
  created_at: Timestamp
}
```

### 2.11. drafts (폼 자동저장)
```ts
{
  draft_id: string
  user_uid: string
  entity_type: 'contract' | 'asset' | 'customer' | 'event'
  body: any                      // 폼 입력값 스냅샷
  created_at: Timestamp
  updated_at: Timestamp
  expires_at: Timestamp          // 7일 후 자동 삭제
}
```

### 2.12. sync_logs (freepasserp 동기화 기록)
```ts
{
  log_id: string
  source: 'freepasserp'
  source_id: string
  target_type: 'contract'
  target_id?: string
  status: 'received' | 'applied' | 'rejected' | 'merged'
  payload: any
  error?: string
  at: Timestamp
}
```

## 3. 보안 규칙 요지

```
match /{entity=**} {
  allow read: if
    request.auth.uid != null
    && (isAdmin() || partnerAccessible(resource.data.partner_code))

  allow write: if
    request.auth.uid != null
    && hasWritePermission(resource)
}

function isAdmin() {
  return getUserDoc().role == 'admin'
}

function partnerAccessible(partner_code) {
  return partner_code in getUserDoc().assigned_partners
}
```

## 4. 인덱스

자주 쓰는 조합 (Firestore composite index):
- `assets` + `partner_code` + `lifecycle_stage`
- `contracts` + `partner_code` + `contract_status` + `end_date`
- `contracts` + `primary_assignee_uid` + `contract_status` (내 일감)
- `billings` + `contract_code` + `due_date`
- `billings` + `partner_code` + `status` + `due_date`
- `events` + `asset_id` + `date DESC`
- `events` + `partner_code` + `type` + `date DESC`
- `notifications` + `recipient_uid` + `read_at` + `created_at DESC`

## 5. 파생 데이터 (Cloud Function 집계)

### 5.1. 차량 손익 `assets/{asset_id}/stats` 서브문서
기존 status-operation.js 계산식을 Cloud Function으로 이동. 관련 events/billings 변경 시 자동 갱신.

```ts
{
  total_revenue: number          // 모든 입금 합
  loan_principal: number
  loan_paid: number
  loan_balance: number
  loan_interest: number
  maint_cost: number
  accident_cost: number
  fuel_cost: number
  wash_cost: number
  penalty_cost: number
  delivery_cost: number
  total_cost: number
  profit: number                 // revenue - cost
  unpaid_count: number
  unpaid_amount: number
  max_overdue_days: number
  updated_at: Timestamp
}
```

### 5.2. 대시보드 집계 `dashboards/{partner_code}`
매 10분 또는 이벤트 트리거로 갱신.

```ts
{
  active_contracts: number
  idle_assets: number
  month_new_contracts: number
  month_terminated_contracts: number
  month_revenue: number
  month_expense: number
  month_profit: number
  overdue_count: number
  overdue_amount: number
  pending_tasks: {               // 6종 미결업무
    not_delivered: number
    unmatched_bank: number
    open_accidents: number
    open_works: number
    open_contacts: number
    open_collects: number
  }
  updated_at: Timestamp
}
```

## 6. 마이그레이션 (RTDB → Firestore)

### 6.1. 매핑

| RTDB 경로 | Firestore 컬렉션 | 비고 |
|---|---|---|
| `/assets/{key}` | `assets/{asset_id}` | key → asset_id |
| `/contracts/{code}` | `contracts/{contract_code}` | |
| `/customers/{key}` | `customers/{customer_id}` | |
| `/billings/{key}` | `billings/{billing_id}` | |
| `/events/{key}` | `events/{event_id}` | |
| `/partners/{code}` | `partners/{partner_code}` | |
| `/members/{uid}` | `users/{uid}` | |
| `/tasks/{key}` | deprecated — events.contact 로 통합 | |
| `/bank_accounts` | (admin 서브) | |
| `/cards` | (admin 서브) | |
| `/seals` | (admin 서브) | |
| `/comments` | `comments/{comment_id}` | |
| `/notifications` | `notifications/{notif_id}` | |
| `/uploads` | Cloud Storage + metadata | |

### 6.2. 스크립트
`scripts/migrate-rtdb-to-firestore.ts` — 컬렉션별 순회 + 스키마 변환 + 배치 쓰기.

실행 순서:
1. 읽기전용 dry-run → 충돌·누락 보고
2. 확인 후 실제 쓰기 (테스트 환경)
3. 데이터 검증 (카운트·샘플 비교)
4. 프로덕션 실행 (기존 jpkerp는 읽기전용 모드)

### 6.3. RTDB → Firestore 형식 차이

- 시간: RTDB는 number(ms) → Firestore Timestamp
- 키: RTDB auto-key → Firestore ID (기존 key 유지)
- 중첩 객체: RTDB flat path → Firestore map 필드
- `status: 'deleted'` 소프트 삭제는 그대로 유지

## 7. zod 스키마 (TypeScript)

모든 엔티티는 `lib/types/` 하위에 zod 스키마로 정의한다. 런타임 검증 + 타입 자동 추론.

```ts
// lib/types/asset.ts
import { z } from 'zod'

export const LifecycleStage = z.enum([
  'acquired', 'marketing', 'contracted', 'delivered',
  'operating', 'expiring', 'returned', 'disposed', 'renewed',
])

export const AssetSchema = z.object({
  asset_id: z.string(),
  partner_code: z.string(),
  car_number: z.string().regex(/^[\d가-힣]+$/),
  vin: z.string().optional(),
  lifecycle_stage: LifecycleStage,
  primary_assignee_uid: z.string().optional(),
  // ...
})

export type Asset = z.infer<typeof AssetSchema>
```

컬렉션 훅(useAssets 등)은 읽을 때 이 스키마로 검증 → 이상 데이터 즉시 탐지.
