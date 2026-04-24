#!/usr/bin/env node
/**
 * 화물차 supplement (봉고III/포터II) 엔트리를 RTDB vehicle_master 에 추가.
 * 기존 엔카 데이터는 건드리지 않음 (_key 가 supplement_* 로 네임스페이스 구분).
 *
 * 사용:
 *   node scripts/import-cargo-supplement.mjs --dry-run
 *   node scripts/import-cargo-supplement.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, update } from 'firebase/database';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.join(__dirname, 'vehicle-master-cargo-supplement.json');
const ROOT = 'vehicle_master';

const app = initializeApp({
  databaseURL: 'https://jpkerp-default-rtdb.asia-southeast1.firebasedatabase.app',
  apiKey: 'AIzaSyCCzPhqUiLXFB0zu41txT9OjKXE8ACqu4Y',
  projectId: 'jpkerp',
});
const db = getDatabase(app);

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const rows = JSON.parse(await fs.readFile(SEED_FILE, 'utf8'));
  console.log(`[cargo] supplement: ${rows.length}개 엔트리`);

  const existingSnap = await get(ref(db, ROOT));
  const existing = existingSnap.exists() ? existingSnap.val() : {};
  console.log(`[cargo] 기존 vehicle_master: ${Object.keys(existing).length}개`);

  const updates = {};
  for (const row of rows) {
    const { _key, ...payload } = row;
    updates[_key] = payload;
    const status = existing[_key] ? '업데이트' : '신규';
    console.log(`  ${status}: ${_key} — ${row.maker} ${row.model} / ${row.sub}`);
  }

  if (dryRun) {
    console.log('\n[dry-run] 실제 변경 없음. --dry-run 빼고 재실행.');
    process.exit(0);
  }

  await update(ref(db, ROOT), updates);
  console.log(`\n[cargo] ✓ ${rows.length}건 저장 완료`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
