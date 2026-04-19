# JPK ERP v2 — UI 규격

작성: 2026-04-17
기반: freepasserp `erp-ui-standards.md` + v2 고유 원칙

## 0. 총칙

- 모든 규격은 **토큰**으로 정의하고 `tailwind.config.ts` + `styles/tokens.css`에 단일 소스로 둔다
- 페이지 CSS는 공통층을 덮어쓰지 말고 필요한 예외만
- 디자인 톤: **Linear/Notion** 수준의 차분함. Sharp(radius 4-6px), 채도 낮은 상태색, 은은한 그림자, 넉넉한 여백
- 둥근 코너 장난감 금지, 원색/굵은 보더/그라데이션 금지

## 1. 레이아웃

### 1.1. 워크스페이스 3분할
```
┌─────────────────────────────────────────────────────────┐
│ Topbar (48px): 로고 · 전역검색(⌘K) · 알림 · 사용자      │
├────────┬──────────────────────────┬─────────────────────┤
│  네비  │   메인                    │  컨텍스트 패널     │
│ 240px  │   flex-1                  │  400px (선택시만)  │
│        │                          │                     │
├────────┴──────────────────────────┴─────────────────────┤
│ 탭바 (36px): 열린 작업들 ⌘+1~9                          │
└─────────────────────────────────────────────────────────┘
```

- 네비 토큰: `--nav-w: 240px`, 접으면 `--nav-w-collapsed: 60px`
- 컨텍스트 패널 토큰: `--context-w: 400px`, 드래그로 300-600 조정 가능
- 탭바: 현재 진행 중인 탭 강조, 중클릭 닫기, Cmd+W 닫기

### 1.2. 반응형 breakpoint
- `sm` 0-767: 모바일 — 사이드바 오버레이, 컨텍스트는 bottom sheet
- `md` 768-1279: 태블릿 — 2분할 (네비 아이콘 + 메인), 컨텍스트는 드로어
- `lg` 1280+: 데스크탑 — 3분할

## 2. 디자인 토큰

### 2.1. 색상
```
/* 중립 */
--c-bg: #fafaf9            /* 페이지 배경 */
--c-bg-sub: #f5f5f4        /* 서브 배경 */
--c-surface: #ffffff       /* 카드·패널 */
--c-border: #e7e5e4        /* 기본 테두리 */
--c-border-strong: #d6d3d1 /* 포커스·선택 테두리 */
--c-text: #1c1917          /* 본문 */
--c-text-sub: #57534e      /* 보조 */
--c-text-muted: #a8a29e    /* 더 흐림·플레이스홀더 */

/* 액센트 — 인디고 단일 */
--c-primary: #4f46e5
--c-primary-bg: #eef2ff
--c-primary-border: #c7d2fe

/* 상태색 (채도 낮음) */
--c-success: #16a34a
--c-success-bg: #f0fdf4
--c-warn: #d97706
--c-warn-bg: #fffbeb
--c-danger: #dc2626
--c-danger-bg: #fef2f2
--c-info: #0284c7
--c-info-bg: #f0f9ff

/* 다크 모드는 토큰만 바꿔서 자동 대응 */
```

### 2.2. 간격
```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-10: 40px
```

### 2.3. 타이포
```
--font-family: 'Pretendard', system-ui, sans-serif
--font-family-mono: 'JetBrains Mono', ui-monospace, monospace

--fs-xs: 11px
--fs-sm: 12px   /* 기본 UI 텍스트 */
--fs-md: 13px   /* 본문 */
--fs-lg: 15px
--fs-xl: 18px
--fs-2xl: 22px  /* 페이지 제목 */

--fw-regular: 400
--fw-medium: 500
--fw-bold: 600
```

숫자는 `font-variant-numeric: tabular-nums` 기본 적용 (정렬 맞추기).

### 2.4. Radius
```
--r-xs: 3px    /* 배지 */
--r-sm: 4px    /* 버튼·입력 */
--r-md: 6px    /* 카드 */
--r-lg: 8px    /* 모달·큰 패널 */
```

### 2.5. Shadow
```
--sh-sm: 0 1px 2px rgba(0,0,0,0.04)
--sh-md: 0 2px 8px rgba(0,0,0,0.06)
--sh-lg: 0 8px 24px rgba(0,0,0,0.08)
--sh-focus: 0 0 0 3px rgba(79, 70, 229, 0.2)
```

## 3. 저장 버튼 금지 원칙

### 3.1. 필드 편집 — 자동 저장
- 포커스 이탈 (blur) 시 debounce 500ms 후 저장
- 저장 성공: 필드 외곽 은은한 초록 flash (300ms) + 토스트 안 씀
- 저장 실패: 빨간 외곽 + 토스트에 오류
- **저장 버튼 UI 없음**

### 3.2. Undo 시스템
- 모든 편집은 5초 토스트로 "되돌리기" 표시
- **Cmd+Z** 단축키로 즉시 되돌리기
- 되돌리기 가능 기간 내엔 변경사항이 감사 로그에 pending으로 표시

### 3.3. 폼 생성 — "등록" 1회만
- 신규 계약·차량 등록은 여러 필드 원자적 처리
- 입력 중엔 `drafts/` 컬렉션에 자동 저장 (탭 닫아도 복원)
- 필수 필드 충족 시 "등록" 버튼 활성화, 클릭 1회로 확정

### 3.4. 확인 다이얼로그 금지
- "정말 삭제?" 없음 → 삭제 시 5초 Undo 토스트
- 파괴적 액션만 예외 (계약 영구 삭제 등, role=admin 전용)

## 4. 공통 컴포넌트

### 4.1. 버튼
- 높이 28px (기본), 24px (sm), 32px (lg)
- 좌우 padding 10px
- variant: `primary | secondary | ghost | danger`
- 아이콘+텍스트 gap 6px
- 클릭 시 눌림 효과는 `scale(0.98)` 50ms

### 4.2. 입력
- 높이 28px 기본
- 배경: 투명, 호버/포커스 시 border 강조
- 편집 불가: `bg: var(--c-bg-sub)`, cursor: default
- placeholder는 보기모드에선 숨김

### 4.3. 배지
- 높이 18px, radius 3px
- padding 0 6px, font-size 11px
- 상태색 + 채도 낮은 배경

### 4.4. 패널헤드
- 높이 40px
- 제목(좌) + 부제(세미부드러운 회색) + 액션(우)
- 하단 1px border

### 4.5. 목록 row
- 높이 공통 토큰 `--list-row-h: 36px` (1행), `--list-row-h-2: 52px` (2행)
- 좌우 padding 12px, 상하 6/8px
- 호버 `bg: var(--c-bg-sub)`
- 선택 시 좌측 3px 인디고 바 + bg 연한 인디고

### 4.6. 카드
- padding 16px, radius 6px
- border 1px + shadow-sm
- 호버 시 shadow-md, border-strong

## 5. 엔티티 뷰 규격

### 5.1. 차량 프로필 (Asset Detail)
```
┌─────────────────────────────────────┐
│ 🚗 98고1234 · K5 2024 · [운영중]    │ 48px 헤더
│ ●──●──●──●──●──○──○                 │ 생애주기 스테퍼 32px
│ 취득 영업 계약 출고 운영 만기 반납  │
├─────────────────────────────────────┤
│ 💰 손익 요약 카드 (flex grid)        │ 80px
├─────────────────────────────────────┤
│ [탭] 개요 | 타임라인 | 수납 | ...   │ 40px
├─────────────────────────────────────┤
│ 선택 탭의 콘텐츠                     │ flex-1
└─────────────────────────────────────┘
```

생애주기 스테퍼 단계:
`취득 · 영업 · 계약 · 출고 · 운영 · 만기 · 반납 · [매각|연장]`

탭 기본 순서:
`개요 · 타임라인 · 계약이력 · 수납 · 사고·정비 · 할부·보험 · 문서 · 사진 · 메모·응대 · AI 제안`

### 5.2. 타임라인
- 시간 역순 (최신 상단)
- 좌측: 날짜 (`YY.MM.DD`)
- 중앙: 이벤트 아이콘 + 타입 색
- 우측: 요약 텍스트
- 클릭 시 인라인 확장 (상세 필드 + 편집)
- 상단 필터: 전체·수납·사고·정비·응대·기타 토글

### 5.3. Kanban
- 단계 컬럼 폭 260px
- 카드 높이 자동 (요약 정보만)
- 드래그로 단계 이동 → 상태 필드 자동 업데이트
- 상단 컬럼 헤더에 건수

### 5.4. 카드 뷰 (차량 목록)
- 2-3열 그리드 (반응형)
- 이미지(상단, 4:3) + 번호 + 모델 + 상태 뱃지 + 담당자

### 5.5. 그리드 뷰 (TanStack Table)
- AG Grid 대체
- 컬럼 리사이즈·드래그·숨김
- 헤더 필터:
  - 드롭다운형 (agSelectCellEditor 대응) → 체크박스 리스트 (빈도 내림차순)
  - 숫자 → 정렬만
  - 그 외 → 텍스트 검색
- 인라인 편집: 클릭→편집→blur→자동저장

## 6. 키보드 단축키

### 6.1. 전역
```
⌘K      명령 팔레트
⌘B      사이드바 토글
⌘Shift+F 전역 검색
⌘1~9    탭 전환
⌘W      탭 닫기
⌘Z      되돌리기
⌘Shift+Z 다시실행
Esc     패널·모달 닫기
?       단축키 도움말
```

### 6.2. 목록
```
J/K (↓/↑)  행 이동
Enter       선택 (컨텍스트 패널에 로드)
E           편집 모드 진입 (인라인)
N           신규 생성
/           목록 내 필터 포커스
Space       체크
⌘A          전체 선택
```

### 6.3. 편집
```
Tab         다음 필드
Shift+Tab   이전 필드
⌘Enter      저장 (명시적 — 자동저장 외에도)
Esc         편집 취소
```

## 7. 상태 머신 (폼 모드)

freepasserp의 idle/view/edit/create 중 **v2는 mode 개념 삭제**. 권한만 확인.

- 읽기 권한만: 필드가 `disabled` 스타일로 표시됨
- 쓰기 권한: 필드 클릭 → 바로 편집, blur → 자동 저장
- 생성: `/new` 경로 접근 시 빈 폼 + draft 자동 저장

예외: **신규 계약 등록**처럼 원자적 묶음이 필요한 경우에만 `draft → submit` 2단계.

## 8. 접근성 (a11y)

- 모든 인터랙티브 요소 키보드 접근 가능
- 포커스 인디케이터: 3px 인디고 외곽
- aria-label 필수 (아이콘 버튼)
- 색만으로 상태 전달 금지 (아이콘/텍스트 병행)
- 최소 대비 비율 4.5:1 (본문), 3:1 (큰 텍스트)

## 9. 마이크로 인터랙션

### 9.1. 전환 시간
```
--ease-fast: 150ms     /* 버튼 호버·눌림 */
--ease-normal: 250ms   /* 패널 열기·탭 전환 */
--ease-slow: 400ms     /* 슬라이드 패널 */

--easing: cubic-bezier(0.4, 0, 0.2, 1)
```

### 9.2. 스켈레톤 로더
- 로딩 시 스피너 대신 실제 UI 형태의 회색 블록
- 1.5s 반복 shimmer 효과

### 9.3. Empty states
- 단순 "데이터 없음" 금지
- 일러스트(심볼) + 설명 + 다음 액션 버튼

## 10. 파일 구조 (컴포넌트 네이밍)

```
components/ui/*              shadcn primitives (Button, Input, Dialog, ...)
components/layout/*          Sidebar, Topbar, TabBar, ContextPanel
components/entity/*          AssetCard, ContractCard, CustomerBadge
components/views/*           GridView, KanbanView, TimelineView, MapView
components/shared/*          PageHeader, EmptyState, Skeleton, UndoToast
```

파일명: `kebab-case.tsx`
컴포넌트명: `PascalCase`
타입명: `PascalCase` (접미사 없이)

## 11. 금기 사항

- `<button onClick={() => confirm(...)}>` — confirm 다이얼로그 금지, Undo 토스트로 대체
- 저장 버튼 (필드 단위)
- 모달 (데이터 상세용) — 슬라이드 패널 사용
- 텍스트만의 상태 표기 — 아이콘·색 병행
- 둥근 버튼(radius > 8px) — Linear 톤 유지
- 원색(#ff0000 등 순색) — 토큰만 사용
- 인라인 style — Tailwind class 사용
- px 직접 사용 — 토큰 참조
