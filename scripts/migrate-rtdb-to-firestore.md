# RTDB → Firestore 마이그레이션 가이드

## 사전 조건

1. Firebase 프로젝트에 Firestore 활성화
2. 서비스 계정 키 준비: `scripts/serviceAccount.json`
   - Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
   - ⚠️ git에 절대 커밋 금지 (`.gitignore`에 포함됨)
3. Node 의존성: `firebase-admin` (scripts에서만 사용)

## 실행 방법

```bash
# 의존성 추가
npm install --save-dev firebase-admin tsx

# Dry run (읽기만, 변환 결과만 보고)
npm run migrate -- --dry

# 실제 실행 (주의: Firestore에 쓰기 작업)
npm run migrate
```

## 마이그레이션 순서

의존성 따라 순서 준수:

1. **partners** (회원사) — 다른 엔티티들이 partner_code 참조
2. **users** (members) — Firebase Auth UID 매핑 필요
3. **customers** (고객)
4. **assets** (차량)
5. **contracts** (계약) — asset_id, customer_id, primary_assignee_uid 보강
6. **billings** (회차)
7. **events** (운영이벤트)
8. **comments, notifications, uploads**

## 스키마 변환 포인트

### 시간 필드
- RTDB: number (epoch ms)
- Firestore: `Timestamp.fromMillis(n)`

### 키
- RTDB: auto-push key
- Firestore: 기존 key 유지 (`doc(coll, key).set(data)`)

### 중첩 경로
- RTDB: `/contracts/{code}/installments/{idx}` — flat path
- Firestore: `contracts/{code}` 문서의 `installments` 배열 필드

### 소프트 삭제
- 그대로 유지 (`status: 'deleted'`)
- 나중에 Cloud Function에서 TTL로 하드 삭제 스케줄

### 새로 추가할 필드
- `primary_assignee_uid` — 기본값 기본 담당자 또는 null
- `sync_status: 'active'` (기존 계약은 모두 active)
- `lifecycle_stage` — 계약/이벤트 기반 추론 (아래 표)

## lifecycle_stage 추론 규칙

| 조건 | stage |
|---|---|
| assets에 있고 계약 없음, 매각 아님 | `acquired` |
| freepasserp에 상품 등록됨, 계약 없음 | `marketing` |
| 계약 있음, delivery 이벤트 없음 | `contracted` |
| 계약 있음, delivery 있고 return 없음 | `delivered`→`operating` |
| 계약 있음, 만기 30일 이내 | `expiring` |
| return 이벤트 있음, 새 계약 없음 | `returned` |
| disposal 이벤트 있음 | `disposed` |
| 계약 있음, original_contract_id 존재 | `renewed` |

## 검증

마이그레이션 후:

```bash
# 카운트 비교
npm run verify -- --collection assets
npm run verify -- --collection contracts

# 샘플 비교 (random 10건)
npm run verify -- --sample 10
```

## 롤백

Firestore는 컬렉션 단위로 일괄 삭제 가능:

```bash
# ⚠️ 운영 환경 사용 금지 — 테스트 환경만
npm run reset -- --collection contracts --confirm
```

기존 RTDB는 손대지 않음. 문제 시 v1 jpkerp로 즉시 복귀.
