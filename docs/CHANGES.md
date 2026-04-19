# Changes

## 2026-04-17 — Phase 0 시작

- jpkerp v2 프로젝트 착수 (`jpkerp-next`)
- 백업 스냅샷: `d:/dev/백업/jpkerp_20260417_205520`
- docs/ARCHITECTURE.md / UI-STANDARDS.md / DATA-MODEL.md 초안 작성
- 핵심 결정:
  - 차량 엔티티 중심, 단일 워크스페이스, 저장버튼 제거
  - 연장운행 = 새 계약 + `original_contract_id` 체인
  - freepasserp 연동 = 계약 체결 이벤트만 단방향 (Cloud Function)
  - 담당자는 계약 담당자 derived, 계약 없을 때만 차량 담당자 직접 지정
  - 스택: Next.js 14 + TS + Tailwind + shadcn/ui + TanStack + Firebase(Auth/Firestore/Functions/Storage) + Vercel + pnpm + Biome
  - RTDB → Firestore 이주
