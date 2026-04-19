#!/usr/bin/env tsx
/**
 * RTDB → Firestore 마이그레이션 스크립트 (skeleton)
 *
 * 실행:
 *   npx tsx scripts/migrate.ts --dry
 *   npx tsx scripts/migrate.ts --collection assets
 *   npx tsx scripts/migrate.ts  (전체)
 *
 * 필요 패키지:
 *   npm i -D firebase-admin tsx
 *
 * 서비스 계정:
 *   scripts/serviceAccount.json (절대 커밋 금지)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

type Step = 'partners' | 'users' | 'customers' | 'assets' | 'contracts' | 'billings' | 'events';

const ORDER: Step[] = ['partners', 'users', 'customers', 'assets', 'contracts', 'billings', 'events'];

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dry: args.includes('--dry'),
    only: args.find((a, i) => a === '--collection' && args[i + 1])
      ? (args[args.indexOf('--collection') + 1] as Step)
      : null,
  };
}

async function main() {
  const { dry, only } = parseArgs();

  // 서비스 계정 확인
  const keyPath = resolve(process.cwd(), 'scripts/serviceAccount.json');
  if (!existsSync(keyPath)) {
    console.error('❌ scripts/serviceAccount.json 없음');
    console.error('   Firebase Console → 프로젝트 설정 → 서비스 계정 → 키 생성');
    process.exit(1);
  }

  // firebase-admin 동적 로드 (설치 전에도 파일은 존재할 수 있도록)
  let admin: typeof import('firebase-admin/app');
  let firestore: typeof import('firebase-admin/firestore');
  let rtdb: typeof import('firebase-admin/database');
  try {
    admin = await import('firebase-admin/app');
    firestore = await import('firebase-admin/firestore');
    rtdb = await import('firebase-admin/database');
  } catch {
    console.error('❌ firebase-admin 설치 필요: npm i -D firebase-admin tsx');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  const app = admin.initializeApp({
    credential: admin.cert(serviceAccount),
    databaseURL: 'https://jpkerp-default-rtdb.asia-southeast1.firebasedatabase.app',
  });

  const db = firestore.getFirestore(app);
  const rdb = rtdb.getDatabase(app);

  const steps = only ? [only] : ORDER;
  console.log(`▶ 마이그레이션 시작 ${dry ? '(DRY RUN)' : ''}`);
  console.log(`▶ 대상: ${steps.join(', ')}`);

  for (const step of steps) {
    console.log(`\n━━ ${step} ━━`);
    const handler = HANDLERS[step];
    await handler({ db, rdb, dry });
  }

  console.log('\n✅ 완료');
}

interface Ctx {
  db: import('firebase-admin/firestore').Firestore;
  rdb: import('firebase-admin/database').Database;
  dry: boolean;
}

const HANDLERS: Record<Step, (ctx: Ctx) => Promise<void>> = {
  partners: async ({ db, rdb, dry }) => {
    const snap = await rdb.ref('partners').get();
    const val = snap.val() || {};
    const entries = Object.entries(val);
    console.log(`  ${entries.length}건 발견`);
    if (dry) return;
    const batch = db.batch();
    for (const [code, data] of entries) {
      batch.set(db.collection('partners').doc(code), {
        ...(data as object),
        partner_code: code,
        active: (data as { active?: boolean }).active !== false,
      });
    }
    await batch.commit();
    console.log(`  ✓ ${entries.length}건 저장`);
  },

  users: async ({ db, rdb, dry }) => {
    // RTDB의 members를 users로
    const snap = await rdb.ref('members').get();
    const val = snap.val() || {};
    const entries = Object.entries(val);
    console.log(`  ${entries.length}건 발견`);
    if (dry) return;
    // TODO: 필드 매핑 — name, role, assigned_partners 등
    console.warn('  ⚠ users 매핑 미구현 — docs/DATA-MODEL.md 참조해서 보강 필요');
  },

  customers: async ({ db, rdb, dry }) => {
    const snap = await rdb.ref('customers').get();
    const val = snap.val() || {};
    const entries = Object.entries(val);
    console.log(`  ${entries.length}건 발견`);
    if (dry) return;
    // TODO: 필수 필드 검증 + 변환
    console.warn('  ⚠ customers 매핑 미구현');
  },

  assets: async ({ db, rdb, dry }) => {
    const snap = await rdb.ref('assets').get();
    const val = snap.val() || {};
    const entries = Object.entries(val);
    console.log(`  ${entries.length}건 발견`);
    if (dry) return;
    // TODO: lifecycle_stage 추론 규칙 (docs 참고)
    console.warn('  ⚠ assets 매핑 미구현 (lifecycle_stage 추론 로직 필요)');
  },

  contracts: async ({ db, rdb, dry }) => {
    const snap = await rdb.ref('contracts').get();
    const val = snap.val() || {};
    const entries = Object.entries(val);
    console.log(`  ${entries.length}건 발견`);
    if (dry) return;
    console.warn('  ⚠ contracts 매핑 미구현');
  },

  billings: async ({ db, rdb, dry }) => {
    const snap = await rdb.ref('billings').get();
    const val = snap.val() || {};
    const entries = Object.entries(val);
    console.log(`  ${entries.length}건 발견`);
    if (dry) return;
    console.warn('  ⚠ billings 매핑 미구현');
  },

  events: async ({ db, rdb, dry }) => {
    const snap = await rdb.ref('events').get();
    const val = snap.val() || {};
    const entries = Object.entries(val);
    console.log(`  ${entries.length}건 발견`);
    if (dry) return;
    console.warn('  ⚠ events 매핑 미구현 (17종 type별 서브필드 변환)');
  },
};

main().catch((err) => {
  console.error('❌ 마이그레이션 실패:', err);
  process.exit(1);
});
