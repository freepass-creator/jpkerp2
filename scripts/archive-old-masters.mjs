#!/usr/bin/env node
/**
 * vehicle_master 에서 15년 이상 지난(단종 15년+) 엔트리를 soft delete.
 *
 * 기준:
 *   - production_end (YYYY-MM) 가 cutoff 보다 이전이면 아카이브
 *   - production_end === '현재' 인 엔트리는 보존 (현재 생산 중)
 *   - production_end 없으면 year_end 로 fallback
 *   - 둘 다 없으면 보존 (판단 불가)
 *
 * Soft delete: status='deleted', archived=true.
 *   → normalizeAsset 의 activeMasters 필터(`status !== 'deleted'`) 에서 자동 제외.
 *   → 과거 이벤트 참조는 그대로 유지됨.
 *
 * 사용:
 *   node scripts/archive-old-masters.mjs --dry-run     # 미리보기만
 *   node scripts/archive-old-masters.mjs               # 실제 적용
 *   node scripts/archive-old-masters.mjs --years=20    # 커스텀 연한 (기본 15)
 */
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, update } from 'firebase/database';

const app = initializeApp({
  databaseURL: 'https://jpkerp-default-rtdb.asia-southeast1.firebasedatabase.app',
  apiKey: 'AIzaSyCCzPhqUiLXFB0zu41txT9OjKXE8ACqu4Y',
  projectId: 'jpkerp',
});
const db = getDatabase(app);
const ROOT = 'vehicle_master';

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run');
  const yearsArg = process.argv.find((a) => a.startsWith('--years='));
  const years = yearsArg ? Number(yearsArg.split('=')[1]) : 15;
  if (!Number.isFinite(years) || years <= 0) throw new Error('--years 인수가 잘못됐습니다');
  return { dryRun, years };
}

function cutoffMonth(years) {
  const now = new Date();
  const y = now.getFullYear() - years;
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** production_end 또는 year_end 에서 "YYYY-MM" 추출. "현재" 면 null(보존). */
function extractEndMonth(entry) {
  const pe = entry.production_end;
  if (pe === '현재') return null;
  if (typeof pe === 'string') {
    const m = pe.match(/^(\d{4})(?:[-\/.](\d{1,2}))?/);
    if (m) return `${m[1]}-${(m[2] ?? '12').padStart(2, '0')}`;
  }
  const ye = entry.year_end;
  if (ye === '현재' || ye == null || ye === '') return null;
  const yn = Number(String(ye).replace(/,/g, ''));
  if (Number.isFinite(yn) && yn > 1900) return `${yn}-12`;
  return null;
}

async function main() {
  const { dryRun, years } = parseArgs();
  const cutoff = cutoffMonth(years);
  console.log(`[archive] 기준: production_end < ${cutoff} (${years}년 이상 단종)`);
  console.log(`[archive] mode: ${dryRun ? 'DRY-RUN' : 'APPLY'}`);

  const snap = await get(ref(db, ROOT));
  if (!snap.exists()) {
    console.log('[archive] vehicle_master 가 비어있음');
    process.exit(0);
  }
  const data = snap.val();
  const entries = Object.entries(data);
  console.log(`[archive] 전체 엔트리: ${entries.length}`);

  const toArchive = [];
  let preserved현재 = 0;
  let preservedAlreadyDeleted = 0;
  let preservedNoData = 0;
  let preservedRecent = 0;

  for (const [key, entry] of entries) {
    if (entry.status === 'deleted') { preservedAlreadyDeleted++; continue; }
    const endMonth = extractEndMonth(entry);
    if (endMonth === null) {
      if (entry.production_end === '현재' || entry.year_end === '현재') preserved현재++;
      else preservedNoData++;
      continue;
    }
    if (endMonth < cutoff) {
      toArchive.push({ key, entry, endMonth });
    } else {
      preservedRecent++;
    }
  }

  console.log(`[archive] 아카이브 대상: ${toArchive.length}`);
  console.log(`[archive] 보존:`);
  console.log(`  - 현재 생산 중: ${preserved현재}`);
  console.log(`  - 기존 deleted: ${preservedAlreadyDeleted}`);
  console.log(`  - 데이터 없음: ${preservedNoData}`);
  console.log(`  - 최근 생산: ${preservedRecent}`);

  if (toArchive.length === 0) {
    console.log('[archive] 아카이브할 엔트리 없음');
    process.exit(0);
  }

  // 상위 20개 샘플 미리보기
  console.log('\n[archive] 상위 20개 샘플:');
  for (const { key, entry, endMonth } of toArchive.slice(0, 20)) {
    console.log(`  ${endMonth}  ${entry.maker ?? '?'} / ${entry.model ?? '?'} / ${entry.sub ?? '?'}  [${key}]`);
  }
  if (toArchive.length > 20) console.log(`  ... 외 ${toArchive.length - 20}건`);

  if (dryRun) {
    console.log('\n[dry-run] 실제 변경 없음. 적용하려면 --dry-run 빼고 재실행.');
    process.exit(0);
  }

  // 배치 업데이트
  const batchSize = 200;
  let done = 0;
  for (let i = 0; i < toArchive.length; i += batchSize) {
    const chunk = toArchive.slice(i, i + batchSize);
    const updates = {};
    for (const { key } of chunk) {
      updates[`${key}/status`] = 'deleted';
      updates[`${key}/archived`] = true;
      updates[`${key}/archived_reason`] = `${years}년 이상 단종 (cutoff=${cutoff})`;
      updates[`${key}/archived_at`] = Date.now();
    }
    await update(ref(db, ROOT), updates);
    done += chunk.length;
    console.log(`[archive] 진행: ${done}/${toArchive.length}`);
  }
  console.log(`[archive] ✓ 완료: ${toArchive.length}건 아카이브`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[archive] 실패:', err);
  process.exit(1);
});
