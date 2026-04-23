# 다음 세션 이어가기

**마지막 작업일**: 2026-04-24
**원격**: github.com/freepass-creator/jpkerp2 (main)

## 오늘 세션 (04-24) 주요 변경

### ✅ 완료·배포
- **모바일 업로드(/m/upload) v1 플로우 + v2 ERP 디자인으로 완전 재작성**
  - 맨 위: 차량번호 검색 + 최근 차량 chip
  - 차량 정보 카드 (회원사·세부모델·계약자·계약상태)
  - 3 카테고리 가로 (출고·반납·상품화) + 액션시트(카메라/앨범)
  - 썸네일 그리드 (4열) + 업로드 진행률 %
  - 초기화·업로드 2버튼 하단 고정 dock (탭바 위)
  - 병렬 업로드 3동시 + 이미지 리사이즈 (2048px, JPEG 0.85)

- **차량번호 선택사항**
  - 확정 → `events` 직접 저장 (photo_urls 묶음)
  - 미확정 → `mobile_uploads` 미결업무 (관리자 inbox 검토 후 반영)

- **/m/* 레이아웃 auth gate** — 비로그인 → `/login?redirect=/m/upload` 자동

- **mobile-inbox 자동 이벤트 생성** — `car_number` 있는 mobile_uploads approve 시 `events/{type}` 레코드 자동 생성

### 🔧 환경 설정 (회사 PC에 적용됨)
- **Firebase Storage 활성화** (`jpkerp.firebasestorage.app` 버킷 생성, asia-northeast3)
- **Storage CORS 설정 완료** (`scripts/firebase-cors.json` → gsutil 적용)
  - 허용: localhost:7401/3000, LAN IP 192.168.45.231:7401, jpkerp.com, *.vercel.app
- **.env.local** 에 `GEMINI_API_KEY` 추가 (로컬 전용, Vercel 미반영 — OCR 제거했으니 무관)
- **next.config.mjs** `allowedDevOrigins: ['192.168.45.231']` 추가 (Next 16 LAN 접근용)

### 🗑️ 정리됨
- `api/ocr/extract` 에서 `plate` 타입 제거 (OCR 제거 후 데드코드)
- 구 `.m-up-*` CSS 블록 전부 교체

---

## 🚧 내일 할 일

### 1. 디자인 규격 통일 · 중복 제거 (핵심)
이전 감사 리포트 (`memory/project_jpkerp_next.md` 참조) 기반 잔여 작업:

**A. 인라인 스타일 청소 — Top 3 파일:**
- [ ] `app/(workspace)/input/operation/op-context-panel.tsx` (25+ 인라인)
- [ ] `app/(workspace)/input/operation/forms/ignition-form.tsx` (36 인라인)
- [ ] `app/(workspace)/upload/upload-client.tsx` (25 인라인)
- 패턴: `style={{ fontSize: 11 }}` → `className="text-xs"`, `color: 'var(--c-text-muted)'` → `className="text-text-muted"`

**B. 버튼 토큰 통합:**
- `.m-up-pick-btn` (제거됨) / `.m-btn` (44px) / `.m-up-submit-btn` (48px)
- `.btn--lg` size modifier 도입 검토

**C. 컴포넌트 승격 후보:**
- `<StatusBadge tone=... dDay=... />` — 조건부 색상 pill 산재
- `<CarInfoDisplay asset contract />` — op-form-base / op-context-panel / m-upload 중복

### 2. 업로드 통합 테스트
- [ ] 로그인 → 차량 선택 → 3카테고리 × 2방법(카메라/앨범) 각각 시나리오
- [ ] 차량 미선택 업로드 → mobile-inbox에서 차량 매칭 + approve → events 생성 확인
- [ ] 업로드한 photo_urls가 asset 프로필 페이지에 잘 노출되는지

### 3. 보류·검토 사항
- **Shell 이원화 (InputFormShell vs OpFormBase)** — 이전 감사에서 "구조적 차이 유지 권장" 나옴. 통합 강행 여부 재검토 불필요.
- **OpKey 17→11 축소** — DB 이벤트 `type` 마이그레이션 필요, 리스크 큼. 보류 유지.

### 4. 기타
- `app/my/page.tsx` 고객 포털 — 연락처 번호 하드코딩 (`1588-0000`, `02-0000-0000`, `jpkpyh@gmail.com`) 실제값 교체
- Vercel env에 `GEMINI_API_KEY` 추가 (나중에 OCR 다시 쓸 때)

---

## 참고 · 현재 아키텍처

**업로드 플로우 (최종)**:
```
폰 /m/upload
  ├── 로그인 확인 (auth gate)
  ├── 차량번호 선택 (선택사항)
  ├── 카테고리 탭 (출고/반납/상품화) → 액션시트 (카메라/앨범)
  ├── 파일 선택 → 썸네일 표시
  ├── [업로드] 클릭
  │
  ├── 차량번호 있음:
  │   ├── Firebase Storage: photos/{type}/{car}/{ts}_{rand}.{ext}
  │   └── RTDB events: { type, car_number, photo_urls, ... }
  │
  └── 차량번호 없음 (미결업무):
      ├── Firebase Storage: photos/{type}/_no_car/{ts}_{rand}.{ext}
      └── RTDB mobile_uploads: { car_number: null, kind, status: 'pending', matched: false, ... }
          → 관리자 /dev?tool=mobile-inbox 에서 차량 매칭 + 반영
          → events 생성 (inbox approve 시 자동)
```

**Firebase Storage 구조**:
```
gs://jpkerp.firebasestorage.app/
  photos/
    delivery/{car_number or _no_car}/...
    return/{car_number or _no_car}/...
    product/{car_number or _no_car}/...
```
