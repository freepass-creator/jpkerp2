/**
 * 기존 자산의 세부모델을 차종마스터와 매칭하여 업데이트
 * 연식 기반 스코어링으로 최적 세부모델 선택
 */
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, update } from 'firebase/database';

const app = initializeApp({
  databaseURL: 'https://jpkerp-default-rtdb.asia-southeast1.firebasedatabase.app',
  apiKey: 'AIzaSyCCzPhqUiLXFB0zu41txT9OjKXE8ACqu4Y',
  projectId: 'jpkerp',
});
const db = getDatabase(app);

const normLow = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '');

function lcsLen(a, b) {
  a = normLow(a); b = normLow(b);
  if (!a || !b) return 0;
  const m = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  let max = 0;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      if (a[i-1] === b[j-1]) { m[i][j] = m[i-1][j-1] + 1; if (m[i][j] > max) max = m[i][j]; }
    }
  return max;
}

function codeTokens(s) {
  return String(s || '').toLowerCase().split(/[\s\-_·/()\[\]]+/).filter(t => /^[a-z0-9]{2,}$/.test(t));
}

async function main() {
  // 1. 차종마스터 로드
  const masterSnap = await get(ref(db, 'vehicle_master'));
  const masters = [];
  if (masterSnap.exists()) {
    for (const [k, v] of Object.entries(masterSnap.val())) {
      if (v.status === 'deleted') continue;
      masters.push({ ...v, _key: k });
    }
  }
  console.log(`차종마스터: ${masters.length}종`);

  // 2. 자산 로드
  const assetSnap = await get(ref(db, 'assets'));
  if (!assetSnap.exists()) { console.log('자산 없음'); process.exit(0); }
  const assets = Object.entries(assetSnap.val())
    .filter(([, v]) => v.status !== 'deleted')
    .map(([k, v]) => ({ ...v, _key: k }));
  console.log(`자산: ${assets.length}대`);

  let updated = 0;
  let skipped = 0;

  for (const asset of assets) {
    const maker = (asset.manufacturer || '').trim();
    const model = (asset.car_model || '').trim();
    const rawSub = (asset.detail_model || '').trim();
    const yy = extractYY(asset);

    if (!maker) { skipped++; continue; }

    // 해당 제조사+모델의 세부모델 후보
    const candidates = masters.filter(m => m.maker === maker && m.model === model);
    if (!candidates.length) { skipped++; continue; }

    // 이미 마스터 세부모델과 정확히 일치하면 스킵
    if (candidates.some(c => c.sub === rawSub)) { skipped++; continue; }

    // 스코어링
    const scored = candidates.map(c => {
      let score = 1.0;
      const sub = c.sub || '';
      const ys = Number(c.year_start || 0);
      const ye = c.year_end === '현재' ? 99 : Number(c.year_end || 99);

      // 텍스트 유사도
      if (rawSub) {
        if (normLow(sub).includes(normLow(rawSub)) || normLow(rawSub).includes(normLow(sub))) score -= 0.4;
        else {
          const lcs = lcsLen(rawSub, sub);
          score -= (lcs / Math.max(normLow(rawSub).length, 1)) * 0.3;
        }
        const inputCodes = codeTokens(rawSub);
        const subCodes = codeTokens(sub);
        score -= inputCodes.filter(t => subCodes.includes(t)).length * 0.25;
      }

      // 연식 매칭 (가장 강한 신호)
      if (yy) {
        if (yy >= ys && yy <= ye) score -= 0.5;
        else if (yy === ys - 1) score -= 0.1;
        else if (yy < ys) score += 0.3;
      }

      // 연료 매칭
      const fuel = normLow(asset.fuel_type);
      const isEV = fuel === '전기';
      if (isEV && /ev|전기/i.test(sub)) score -= 0.3;
      else if (!isEV && /ev|전기/i.test(sub) && fuel) score += 0.3;

      return { sub, score, category: c.category, fuel_type: c.fuel_type, displacement: c.displacement, seats: c.seats, origin: c.origin, powertrain: c.powertrain, battery_kwh: c.battery_kwh };
    });

    scored.sort((a, b) => a.score - b.score);
    const best = scored[0];

    if (!best || best.score >= 0.9) { skipped++; continue; }

    // 업데이트
    const patch = { detail_model: best.sub, updated_at: Date.now() };
    // 빈 스펙도 채움
    if (!asset.category && best.category) patch.category = best.category;
    if (!asset.fuel_type && best.fuel_type) patch.fuel_type = best.fuel_type;
    if (!asset.displacement && best.displacement) patch.displacement = best.displacement;
    if (!asset.seats && best.seats) patch.seats = best.seats;
    if (!asset.origin && best.origin) patch.origin = best.origin;
    if (!asset.powertrain && best.powertrain) patch.powertrain = best.powertrain;
    if (!asset.battery_kwh && best.battery_kwh) patch.battery_kwh = best.battery_kwh;

    await update(ref(db, `assets/${asset._key}`), patch);
    updated++;
    if (updated <= 10) console.log(`  ${asset.car_number}: "${rawSub}" → "${best.sub}" (${best.score.toFixed(2)})`);
  }

  console.log(`\n완료: ${updated}건 업데이트 / ${skipped}건 스킵`);
  process.exit(0);
}

function extractYY(data) {
  if (data.car_year) {
    const y = String(data.car_year).replace(/,/g, '').trim();
    if (/^\d{4}$/.test(y)) return Number(y.slice(2));
    if (/^\d{2}$/.test(y)) return Number(y);
  }
  if (data.first_registration_date) {
    const m = String(data.first_registration_date).match(/(\d{2,4})/);
    if (m) return Number(m[1].length === 4 ? m[1].slice(2) : m[1]);
  }
  return null;
}

main().catch(e => { console.error(e); process.exit(1); });
