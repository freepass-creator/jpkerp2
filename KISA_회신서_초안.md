# 개인정보 유출 신고 조치결과 회신서

**수신**: 한국인터넷진흥원 (KISA) / 개인정보보호위원회
**발신**: [회사명] (사업자등록번호: [---])
**작성일**: 2026년 4월 24일
**담당자**: [이름] / [직책] / [전화] / [이메일]

---

## 1. 사고 개요

| 항목 | 내용 |
|---|---|
| 신고 접수일 | 2026년 4월 24일 |
| 조치 완료일 | 2026년 4월 24일 |
| 대상 시스템 | jpkerp (사내 차량 관리 ERP, Next.js + Firebase Realtime Database + Cloud Storage) |
| 노출 경로 | Firebase 기본 보안 규칙의 임시 개방 설정이 운영 전환 시 교체되지 않음 |

## 2. 유출 가능성이 있던 개인정보 항목

※ 실제 대량 유출 여부는 Firebase 사용량 로그 분석 중이며, **비정상 트래픽은 확인되지 않았음**.

- 고객 성명
- 연락처 (휴대전화)
- 주소 / 본사주소
- 사업자등록번호 / 주민등록번호 (암호화 전 저장)
- 차량번호
- 운전면허번호
- 계약 관련 정보

## 3. 원인 분석

Firebase Console 에서 Realtime Database · Cloud Storage 최초 활성화 시 자동 적용되는 **30일 임시 개방 규칙**이 프로덕션 전환 시점에 교체되지 않고 유지됨.

**기존 규칙 (취약)**
```json
{
  "rules": {
    ".read": "now < 1777906800000",   // 2026-05-05 까지 누구나 읽기
    ".write": "now < 1777906800000"   // 2026-05-05 까지 누구나 쓰기
  }
}
```

**Cloud Storage 기존 규칙 (취약)**
```
allow read, write: if request.time < timestamp.date(2026, 5, 24);
```

→ Firebase Database URL을 아는 외부자가 인증 없이 전체 데이터 열람 가능한 상태였음.

## 4. 조치 내역

### 4-1. Realtime Database 보안 규칙 교체 (2026-04-24 [HH:MM])

- 기본 접근 `false` (차단)
- 모든 경로 **인증 필수** (`auth != null`)
- 민감 테이블(`users`, `settings`, `car_models` 등)은 **관리자 권한 필수**
- `users/{uid}.role` 필드는 **관리자만 수정 가능** (권한 상승 공격 차단)
- 세부 규칙 첨부파일 `database.rules.json` 참조

### 4-2. Cloud Storage 보안 규칙 교체 (2026-04-24 [HH:MM])

- 모든 경로 **인증 사용자만** 읽기/쓰기
- 프로필 사진은 **본인 UID 일치** 시만 쓰기
- 세부 규칙 첨부파일 `storage.rules` 참조

### 4-3. 미사용 보조 DB 완전 차단

- `jpkerp` (보조 RTDB, 미사용) 는 `.read: false, .write: false` 로 완전 잠금

### 4-4. 외부 접근 차단 검증

시크릿 브라우저로 다음 URL 직접 호출 결과:

```
GET https://jpkerp-default-rtdb.asia-southeast1.firebasedatabase.app/.json
GET https://jpkerp-default-rtdb.asia-southeast1.firebasedatabase.app/users.json
GET https://jpkerp-default-rtdb.asia-southeast1.firebasedatabase.app/customers.json
GET https://jpkerp-default-rtdb.asia-southeast1.firebasedatabase.app/contracts.json

→ 모두 {"error": "Permission denied"} 응답
```

(첨부 스크린샷: `외부접근_차단_검증.png`)

## 5. 피해 범위 확인

- Firebase Console 의 Realtime Database 사용량 지표 분석 결과 (2026-03-24 ~ 2026-04-24):
  - [사용량 탭 스크린샷 첨부]
  - 비정상 Read 트래픽 급증 구간: [없음 / 확인된 구간: ---]
- 외부 유출 의심 로그: [없음 / 있음 – 상세]
- 영향 고객 수: [0명 / N명 추정]

## 6. 피해자 통지 계획

[선택 A] 실 유출 정황이 확인되지 않아 현재 단계에선 개별 통지 대신 홈페이지 공지 예정
[선택 B] 개인정보 영향 가능 고객 N명에 대해 [통지수단]으로 [날짜]까지 통지 완료 예정

## 7. 재발 방지 대책

### 7-1. 보안 규칙의 버전관리 체계 도입

- `database.rules.json`, `storage.rules`, `firebase.json` 을 GitHub 저장소 내 관리
- 배포 시 `firebase deploy --only database,storage` 로 코드와 함께 적용

### 7-2. 비밀값 관리 정책 강화

- API 키·비밀키는 환경변수(`.env.local`)로 분리
- `.gitignore` 에 환경변수 파일 포함 확인
- pre-commit hook 으로 하드코드 API 키 검출

### 7-3. 정기 점검 주기 설정

- 분기별 보안 규칙 감사
- Firebase Console 경고 알림 상시 모니터링

### 7-4. 접근 권한 최소화 원칙

- 직원 계정은 `role` 기반 RBAC 적용
- 회원사 직원은 `assigned_partners` 로 데이터 범위 제한

## 8. 첨부자료

1. 변경 전 보안 규칙 (스크린샷)
2. 변경 후 보안 규칙 (스크린샷 + 원본 파일)
3. 외부 접근 차단 검증 화면 (스크린샷)
4. Firebase 사용량 분석 화면 (스크린샷)

---

**확인**: 상기 조치를 완료하였으며 추가 요청사항 있을 시 즉시 대응하겠습니다.

2026년 4월 24일

[회사명]
대표 [성명] (인)
