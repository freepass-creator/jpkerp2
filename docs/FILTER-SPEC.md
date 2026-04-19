# Filter 규격

작성: 2026-04-18

모든 AG Grid 컬럼의 필터·정렬 규칙 단일 기준.

## 1. 컬럼 타입별 필터

| 컬럼 타입 | 필터 | 정렬 | 예시 |
|---|---|---|---|
| **select** (드롭다운·카테고리) | `JpkSetFilter` | ✓ | 회사코드·제조사·외장색·상태·사유 |
| **text** (자유 텍스트) | `agTextColumnFilter` | ✓ | 계약자명·차량번호·메모·주소 |
| **number** (숫자·금액·회수) | 없음 | ✓ | 월렌트·미납액·연체일·주행거리 |
| **date** (날짜·D-day) | `agDateColumnFilter` | ✓ | 계약시작·만기·발생일 |
| **action** (행번호·액션) | 없음 | ✗ | `#`·편집 버튼 |

### 판별 기준
- **select** → 고유값이 유한하고 10개 이하인 경우가 많을 때 (동일 값 반복)
- **text** → 이름·설명 등 자유 입력
- **number** → 숫자 비교·정렬이 주인 데이터
- **date** → 기간·시점 의미
- **action** → 인터랙션 전용

의심스러우면 기본 `text`.

## 2. 필터 UI 규격 (JpkSetFilter)

- 팝업 폭: **220px**, 최대 높이 **320px**
- 항목 높이: **26px**
- 상단: **정렬 버튼 행** (오름차순 빨강 / 내림차순 파랑) — 정렬도 여기서 토글
- 상단 바로 아래: **검색 input** (필터 안에서 항목 검색)
- 중앙: 체크박스 리스트 — **빈도 내림차순** 기본 (자주 쓰는 값 위로)
- 각 항목: `[✓] 라벨 (빈도수)`
- 하단: `전체 해제` | `초기화` | `적용`
- 적용 모드: **자동 적용** (체크박스 클릭 즉시 반영, 대량 선택 시 디바운스 100ms)

## 3. 시각 피드백 (헤더 규격)

### 필터 걸림
- 배경: `rgba(79, 70, 229, 0.04)` (연한 인디고)
- 라벨 색: `var(--c-primary)` · weight 700
- 헤더 우상단 **카운트 뱃지** (주황) — 선택된 값 개수 표시

### 정렬
- 오름차순: 배경 `rgba(239, 68, 68, 0.03)` · 라벨 `#dc2626` · weight 700
- 내림차순: 배경 `rgba(37, 99, 235, 0.03)` · 라벨 `#2563eb` · weight 700

### 필터 + 정렬 동시
- 배경: 대각선 그라데이션
- 두 색 모두 유지

### 비활성 상태
- 아이콘(정렬·필터) **완전 숨김** (opacity 0)
- 헤더 호버 시 아이콘 `opacity: 1` 노출

## 4. 코드 규약

### 컬럼 정의 — `typedColumn` 헬퍼 사용 (권장)

```ts
import { typedColumn } from '@/lib/grid/typed-column';

const columnDefs = [
  typedColumn('action', { headerName: '#', width: 45, valueGetter: ... }),
  typedColumn('select', { headerName: '회사코드', field: 'partner_code', width: 85 }),
  typedColumn('text',   { headerName: '계약자', field: 'contractor_name', width: 90 }),
  typedColumn('number', { headerName: '연체일', field: 'max_days', width: 75 }),
  typedColumn('date',   { headerName: '시작일', field: 'start_date', width: 100 }),
];
```

### 또는 수동 필드 지정

```ts
{ headerName: '회사코드', field: 'partner_code', width: 85, filter: JpkSetFilter }
{ headerName: '월렌트', field: 'rent_amount', width: 100, filter: false, cellStyle: { textAlign: 'right' } }
{ headerName: '차량번호', field: 'car_number', width: 95 } // 기본 text 필터
```

## 5. 필터 카운트 뱃지 자동 갱신

`JpkGrid`는 `filterChanged` 이벤트에서 헤더 셀의 `data-filter-count` 속성을 자동 업데이트.
CSS가 `::after`로 뱃지 렌더링.

## 6. 정렬 규칙

- **기본 정렬 없음** (데이터 기본 순서 유지)
- **1차 정렬 조건**이 명확한 페이지는 컬럼 정의에 `sort: 'desc'` 명시 (예: 미납 연체일 내림차순)
- 사용자 정렬은 **localStorage에 컬럼 상태**로 저장

## 7. 검증 체크리스트

각 페이지 그리드 작성 시 확인:
- [ ] 모든 카테고리성 컬럼에 `JpkSetFilter`
- [ ] 모든 숫자 컬럼 `filter: false`
- [ ] 모든 날짜 컬럼 `agDateColumnFilter`
- [ ] 행번호 등 액션 컬럼 `filter: false, sortable: false`
- [ ] 기본 정렬이 의미있는 컬럼만 `sort: 'asc'|'desc'` 명시
- [ ] `storageKey` 지정 (페이지별 고유)
