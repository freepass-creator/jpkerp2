# JPK ERP v2 (jpkerp-next) — Architecture

작성: 2026-04-17

## 1. 만드는 이유

기존 jpkerp는 엑셀식 그리드 페이지가 46개. 한 차량/고객/계약을 보려면 여러 페이지를 왕복해야 함. 수정·저장 버튼이 많아 클릭 수가 불필요하게 많음. 직원의 실제 업무 흐름(차량 생애주기)과 메뉴 구조(기능 단위 시트)가 어긋남.

## 2. 핵심 설계 원리

### 2.1. 차량(Asset)이 1급 시민

모든 운영 데이터는 차량 한 대에 수렴한다.

```
취득 → 영업 → 계약 → 운영중(사후관리) → 만기 → 반납 → 매각 or 연장
```

차량 프로필 페이지 한 장에 계약이력·수납·사고·정비·사진·문서·손익이 모두 들어온다. 다른 페이지로 이동하지 않는다.

### 2.2. 단일 워크스페이스 (이동 금지)

```
┌──────────────────────────────────────────────────────┐
│ Topbar (검색 ⌘K · 알림 · 사용자)                     │
├────┬──────────────────┬──────────────────────────────┤
│ 네비│  목록·파이프라인 │  컨텍스트 패널 (선택 엔티티) │
├────┴──────────────────┴──────────────────────────────┤
│ 탭바: 열린 작업들 (Cmd+1~9 전환)                     │
└──────────────────────────────────────────────────────┘
```

- 사이드바 메뉴 선택은 1회. 그 뒤는 우측 패널 교체만
- 관계 링크(계약 ↔ 차량 ↔ 고객) 클릭 시 패널만 바뀌고 URL은 갱신됨
- 모달 금지. 비주 액션은 우측 슬라이드-인 패널

### 2.3. 저장 버튼 제거

- 필드 단위 편집 = 포커스 이탈 시 자동 저장 (debounce 500ms + Undo 토스트 5초)
- 폼 단위 생성(신규 계약 등) = 자동 draft 저장 + 최종 "등록" 1회
- 확인 다이얼로그 금지 → Cmd+Z 되돌리기
- 읽기전용 필드는 회색 배경 + 커서로 편집 불가 명시

### 2.4. 미결업무 대시보드 = 직원 홈

로그인 직후 화면. 기존 home.js의 6종 미결업무 로직 계승:
- 미출고 계약
- 통장/카드 거래 미매칭
- 사고 미종결
- 차량케어 진행중 (정비·수리·상품화·세차)
- 고객센터 진행중·보류
- 미수 조치 미완료

+ v2 추가:
- 내 담당 자동 필터 (primary_assignee_uid)
- 이번달 손익 카드 (전월 대비)
- 만기 14일 내 계약, 이번달 신규·해지
- 팀 활동 피드 (실시간)

### 2.5. 엑셀 습관 흡수 + 탈피

엑셀을 흡수하는 장치:
- 셀 인라인 편집, Tab/Enter/화살표
- Ctrl+C/V/Z, 범위 붙여넣기
- 원클릭 엑셀 내보내기·불러오기

엑셀에서 벗어나는 뷰:
- 기본 화면: 대시보드·카드·Kanban·타임라인
- 그리드는 필요한 곳(자금일보·벌크 편집·리포트)에만
- Airtable식 뷰 토글: 같은 데이터의 다른 표현

## 3. 스택

### 3.1. Frontend
- **Next.js 14 App Router** — Vercel 연속성·SSR·최대 생태계
- **TypeScript strict** — 21K 라인 규모에 필수
- **Tailwind CSS + shadcn/ui** — 복붙형 컴포넌트, 디자인 토큰 통합
- **TanStack Query** — Firebase 구독 관리·캐시·낙관적 업데이트
- **TanStack Table** — AG Grid 대체, 더 가볍고 React-native
- **Zustand** — UI 상태 (탭 바, 선택, 사이드바 접힘)
- **Radix UI primitives** — 접근성·키보드 조작

### 3.2. Backend
- **Firebase Auth** — 기존 동일
- **Cloud Firestore** — RTDB에서 이주 (쿼리·인덱스·보안규칙·트랜잭션 우수)
- **Cloud Functions** — 감사로그, freepasserp 동기화, 만기 알림, 자동이체
- **Cloud Storage** — 사진·문서

### 3.3. DevEx
- **pnpm** — 패키지 매니저
- **Biome** — lint + format (ESLint+Prettier 대체)
- **Vitest** — 단위 테스트
- **Playwright** — E2E
- **Sentry** — 에러·성능 모니터링
- **Storybook** — UI 컴포넌트 회귀

### 3.4. Deploy
- **Vercel** — Next.js 프론트
- **Firebase** — DB + Functions + Storage
- **GitHub Actions** — CI (테스트·빌드·타입체크)

## 4. 주요 결정

### 4.1. RTDB → Firestore 이주
ERP처럼 관계·쿼리가 많은 앱은 Firestore가 적합. 복합 인덱스, WHERE IN, 배치 트랜잭션, 보안규칙 쿼리가 RTDB보다 훨씬 강력. v2는 새 DB로 시작하고 기존 데이터는 스크립트로 한 번에 마이그레이션.

### 4.2. 연장운행 = 새 계약 + 체인
계약을 종료하지 않고 Term을 추가하는 방식보다, **새 Contract 생성 + `original_contract_id`로 이전 계약 링크**가 단순하고 기존 패턴과 호환. 차량 프로필 타임라인에서 체인을 따라가며 표시.

### 4.3. freepasserp 연동 = 단방향 Cloud Function
- freepasserp에서 "계약 체결됨" 상태 변경 → Cloud Function 트리거 → jpkerp-next contracts에 `sync_status: 'pending_review'` 로 생성
- 관리자 UI에서 필드 보완 후 `sync_status: 'active'`로 승격
- 체결 이후 운영 변경은 jpkerp-next가 마스터. 상담/견적은 freepasserp에 머무름.

### 4.4. 담당자 derived 원칙
- 계약 담당자가 기본 진실: `contract.primary_assignee_uid`
- 차량이 계약 중이면 그 계약의 담당자가 차량 담당자
- 계약 없을 때(휴차·매각대기)만 `asset.primary_assignee_uid` 직접 지정
- events는 별도 `handler_uid` (그때그때 실행자)

### 4.5. 회원사(partner_code) 분리
- 모든 엔티티는 `partner_code` 필드 보유
- 사용자는 `assigned_partners[]`로 접근 권한 제한
- 관리자(role: admin)는 전체 접근

## 5. 폴더 구조

```
jpkerp-next/
├─ app/
│  ├─ (workspace)/          # 로그인 후 레이아웃
│  │  ├─ layout.tsx         # 사이드바·탑바·탭바 쉘
│  │  ├─ page.tsx           # 대시보드
│  │  ├─ my/page.tsx        # 내 일감
│  │  ├─ assets/
│  │  │  ├─ page.tsx        # 차량 목록 (카드/그리드/맵/Kanban 토글)
│  │  │  └─ [carNumber]/page.tsx   # 차량 프로필
│  │  ├─ contracts/page.tsx # 계약 Kanban
│  │  ├─ billings/page.tsx  # 자금 (일보·수납·매칭)
│  │  ├─ incidents/page.tsx # 사고·보험
│  │  ├─ analytics/page.tsx # 분석
│  │  └─ admin/...
│  ├─ api/                   # Next.js API routes
│  └─ login/page.tsx
├─ components/
│  ├─ ui/                    # shadcn primitives
│  ├─ layout/                # sidebar, topbar, tabbar, context-panel
│  ├─ entity/                # AssetCard, ContractCard, CustomerCard
│  ├─ views/                 # GridView, KanbanView, MapView, CalendarView, TimelineView
│  └─ shared/
├─ lib/
│  ├─ firebase/              # 클라이언트·어드민 설정
│  ├─ collections/           # 컬렉션별 훅 (useAssets, useContract, useBillings)
│  ├─ hooks/                 # useAutoSave, useTabBar, useUndo
│  ├─ types/                 # zod 스키마 + TS 타입
│  ├─ utils/
│  └─ stores/                # Zustand stores (tabs, selection, ui)
├─ functions/                # Cloud Functions
│  ├─ sync-freepasserp.ts
│  ├─ audit-log.ts
│  ├─ notifications-scheduler.ts
│  └─ auto-debit.ts
├─ styles/
├─ docs/
│  ├─ ARCHITECTURE.md        # 이 문서
│  ├─ UI-STANDARDS.md
│  ├─ DATA-MODEL.md
│  └─ CHANGES.md
├─ scripts/                  # 마이그레이션·시드
├─ tests/
├─ package.json (pnpm)
├─ tsconfig.json
├─ biome.json
├─ next.config.mjs
└─ tailwind.config.ts
```

## 6. 메뉴 (v2)

기존 46페이지 → v2 ~15페이지로 통합:

```
🏠 대시보드        (미결업무 + 손익 + 팀 활동)
📬 내 일감         (담당 필터 기반 대시보드)
🚗 차량            (생애주기 중심, 프로필 + 목록 다뷰)
📄 계약            (Kanban 파이프라인 기본)
💰 자금            (일보 + 수납 + 매칭 + 세금계산서)
🛡️ 사고·보험       (Kanban + 타임라인)
📊 분석            (손익 리포트, 코호트)
✏️ 운영 입력       (기존 input-operation 계승)
📥 업로드          (기존 upload 계승)
⚙️ 관리            (회원사·직원·권한·워크플로우)
```

`/operation/contact|delivery|maint|accident|wash|fuel` 7페이지는 차량 프로필 타임라인 + 운영 이력 1페이지에서 타입 필터로 처리.

## 7. 단계적 이행 계획

### Phase 0 — 문서 + 스캐폴드 (이번 주말)
- docs/ARCHITECTURE / UI-STANDARDS / DATA-MODEL 작성
- Next.js 14 + TS + Tailwind + shadcn + biome + pnpm 세팅
- 기본 레이아웃 쉘 (사이드바·탑바·탭바·컨텍스트 패널)

### Phase 1 — 읽기 전용 코어 (2주)
- Firestore 연결 + 기존 RTDB 스키마 마이그레이션 스크립트
- 대시보드 (home.js 로직 이식 + 개선)
- 차량 프로필 (타임라인 + 손익 + 계약 이력)
- 계약 Kanban (read only)

### Phase 2 — 인라인 편집 (2주)
- 자동저장 훅 (useAutoSave)
- 감사 로그 Cloud Function
- Undo 토스트
- 인라인 편집이 필요한 필드 점진 적용

### Phase 3 — 입력 폼 (2주)
- 계약 신규 등록 폼
- 운영업무 입력 (기존 input-operation 이식)
- 업로드 + OCR
- freepasserp 동기화 Cloud Function

### Phase 4 — 고급 (4주)
- 저장된 뷰·필터
- 파이프라인 드래그
- 지도 뷰 (GPS)
- AI 기능 (자연어 검색·요약·제안)
- 알림 센터
- 자동화 워크플로우

### Phase 5 — 운영 이행 (2주)
- 데이터 마이그레이션 최종 실행
- 기존 jpkerp 읽기전용 보관
- v2 배포 + 온보딩

## 8. 기존 jpkerp와의 공존 기간

- `d:/dev/jpkerp` (포트 7400) — 기존 운영 유지, v2 준비 기간 내내 가동
- `d:/dev/jpkerp-next` (포트 7401) — v2 개발
- 백업 스냅샷: `d:/dev/백업/jpkerp_20260417_205520`

운영 전환은 Phase 5 완료 후 한 번에. 롤백 대비 기존 jpkerp는 최소 3개월 읽기전용으로 유지.
