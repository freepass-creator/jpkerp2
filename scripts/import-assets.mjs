/**
 * 자산 CSV → 정규화 → RTDB 직접 저장
 * node scripts/import-assets.mjs
 */
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, set, get } from 'firebase/database';

const app = initializeApp({
  databaseURL: 'https://jpkerp-default-rtdb.asia-southeast1.firebasedatabase.app',
  apiKey: 'AIzaSyCCzPhqUiLXFB0zu41txT9OjKXE8ACqu4Y',
  projectId: 'jpkerp',
});
const db = getDatabase(app);

// ── 제조사 별칭 ──
const MAKER_ALIAS = {
  hyundai: '현대', '현대자동차': '현대', '현대차': '현대',
  kia: '기아', '기아자동차': '기아', '기아차': '기아',
  genesis: '제네시스', kgm: 'KGM', ssangyong: 'KGM', '쌍용': 'KGM',
  gm: '쉐보레', chevrolet: '쉐보레', 'gm대우': '쉐보레', '쉐보래': '쉐보레',
  renault: '르노', '르노삼성': '르노',
  bmw: 'BMW', '비엠더블유': 'BMW', benz: '벤츠', mercedes: '벤츠', '메르세데스벤츠': '벤츠',
  audi: '아우디', volkswagen: '폭스바겐', vw: '폭스바겐',
  porsche: '포르쉐', '포르셰': '포르쉐', mini: '미니', tesla: '테슬라',
  volvo: '볼보', lexus: '렉서스', toyota: '토요타', honda: '혼다',
  ford: '포드', jeep: '지프', landrover: '랜드로버',
  maserati: '마세라티', ferrari: '페라리', bentley: '벤틀리',
  rollsroyce: '롤스로이스', cadillac: '캐딜락', lincoln: '링컨',
};

const FUEL_ALIAS = {
  ev: '전기', electric: '전기', '전기차': '전기',
  '경유': '디젤', diesel: '디젤',
  '휘발유': '가솔린', gasoline: '가솔린',
  hybrid: '하이브리드', hev: '하이브리드',
  lpg: 'LPG', lpgi: 'LPG', '수소': '수소',
};

// BMW/벤츠 모델번호 매핑
const MODEL_NUM = {
  '320': '3시리즈', '330': '3시리즈', '520': '5시리즈', '523': '5시리즈',
  '525': '5시리즈', '530': '5시리즈', '540': '5시리즈', '640': '6시리즈',
  '730': '7시리즈', '740': '7시리즈', '750': '7시리즈',
  c200: 'C-클래스', c220: 'C-클래스', c300: 'C-클래스',
  e200: 'E-클래스', e220: 'E-클래스', e250: 'E-클래스', e300: 'E-클래스',
  s350: 'S-클래스', s400: 'S-클래스', s450: 'S-클래스', s500: 'S-클래스', s580: 'S-클래스',
  glc200: 'GLC', glc220: 'GLC', glc300: 'GLC',
  cls300: 'CLS', cls400: 'CLS',
};

function normLow(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ''); }

function normMaker(raw) {
  const key = normLow(raw);
  return MAKER_ALIAS[key] || raw.trim();
}

function normFuel(raw) {
  if (!raw) return '';
  const key = normLow(raw);
  return FUEL_ALIAS[key] || raw.trim();
}

function normModel(maker, rawModel, rawSub) {
  const makerLow = normLow(maker);
  let model = (rawModel || '').trim();
  let sub = (rawSub || '').trim();

  // 제조사 접두어 제거: "BMW 520D" → "520D", "BMW530i" → "530i"
  const aliases = Object.entries(MAKER_ALIAS).filter(([,v]) => v === maker).map(([k]) => k);
  for (const a of [makerLow, ...aliases]) {
    const re = new RegExp('^' + a + '[\\s\\-]*', 'i');
    const attempt = model.replace(re, '').trim();
    if (attempt && normLow(attempt) !== normLow(model)) { model = attempt; break; }
  }
  // "벤츠C200" → "C200", "벤츠S450" → "S450"
  if (normLow(model).startsWith(makerLow)) {
    model = model.slice(maker.length).trim();
  }

  // BMW/벤츠 모델번호 매핑: "530i" → "5시리즈"
  const numKey = normLow(model).replace(/[dise]+$/, '');
  if (MODEL_NUM[numKey]) model = MODEL_NUM[numKey];

  // "카니발 리무진" → "카니발", "카니발 하이리무진" → "카니발"
  if (model.includes('카니발')) model = '카니발';
  // "그랜저 HG" → "그랜저", "그랜저 하이브리드" → "그랜저"
  if (model.includes('그랜저')) model = '그랜저';
  // "아반떼 CN7" → "아반떼", "아반떼 N" → "아반떼"
  if (model.includes('아반떼')) model = '아반떼';
  // "그랜드 스타렉스" → "그랜드 스타렉스", "스타렉스" → "그랜드 스타렉스"
  if (model === '스타렉스') model = '그랜드 스타렉스';
  // "포터" → "포터2"
  if (model === '포터') model = '포터2';
  // "마세라티" (제조사=모델) → 세부모델에서 추출
  if (normLow(model) === normLow(maker) && sub) {
    // "마세라티 기블리" → "기블리"
    const subStripped = sub.replace(new RegExp('^' + makerLow + '[\\s]*', 'i'), '').trim();
    if (subStripped) model = subStripped.split(/\s/)[0];
  }
  // "쉐보레" (제조사=모델) → 세부모델에서 추출
  if (normLow(model) === normLow(maker) && sub) {
    model = sub.split(/\s/)[0];
  }
  // "미니쿠퍼컨트리맨" → "컨트리맨"
  if (model.includes('컨트리맨')) model = '컨트리맨';
  if (model.includes('쿠퍼') && !model.includes('컨트리맨')) model = '쿠퍼';
  // "k3 GT" → "K3"
  model = model.replace(/\s*(GT|터보)$/i, '').trim();
  if (/^k\d$/i.test(model)) model = model.toUpperCase();
  // "모델3" → "모델 3"
  if (model === '모델3') model = '모델 3';

  return { model, sub };
}

// ── CSV 파서 ──
function parseCSV(text) {
  const lines = text.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, j) => { row[h.trim()] = (vals[j] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

// ── 메인 ──
async function main() {
  const csv = fs.readFileSync('scripts/assets.csv', 'utf-8');
  const rows = parseCSV(csv);
  console.log(`총 ${rows.length}행 파싱`);

  // 기존 자산 체크 (중복 방지)
  const existingSnap = await get(ref(db, 'assets'));
  const existingCars = new Set();
  if (existingSnap.exists()) {
    for (const v of Object.values(existingSnap.val())) {
      if (v.car_number && v.status !== 'deleted') existingCars.add(v.car_number);
    }
  }
  console.log(`기존 자산: ${existingCars.size}대`);

  let ok = 0, skip = 0, dup = 0;
  for (const row of rows) {
    const carNumber = (row['차량번호'] || '').trim();
    if (!carNumber) { skip++; continue; }
    if (existingCars.has(carNumber)) { dup++; continue; }

    const rawMaker = row['제조사'] || '';
    const rawModel = row['모델명'] || '';
    const rawSub = row['세부모델'] || '';
    const rawFuel = row['연료'] || '';

    const maker = normMaker(rawMaker);
    const { model, sub } = normModel(maker, rawModel, rawSub);
    const fuel = normFuel(rawFuel);

    const payload = {
      partner_code: (row['회원사코드'] || '').trim() || undefined,
      car_number: carNumber,
      vin: (row['차대번호'] || '').trim() || undefined,
      manufacturer: maker,
      car_model: model,
      detail_model: sub || rawSub,
      car_year: Number(String(row['연식'] || '').replace(/,/g, '')) || undefined,
      fuel_type: fuel || undefined,
      ext_color: (row['외부색상'] || '').trim() || undefined,
      int_color: (row['내부색상'] || '').trim() || undefined,
      first_registration_date: (row['최초등록일'] || '').trim() || undefined,
      displacement: Number(String(row['배기량'] || '').replace(/,/g, '')) || undefined,
      seats: Number(String(row['인승'] || '').replace(/,/g, '')) || undefined,
      transmission: (row['변속기'] || '').trim() || undefined,
      category: (row['차종'] || '').trim() || undefined,
      usage_type: (row['용도'] || '').trim() || undefined,
      acquisition_cost: Number(String(row['취득원가'] || '').replace(/,/g, '')) || undefined,
      current_mileage: Number(String(row['주행거리'] || '').replace(/,/g, '')) || undefined,
      asset_code: `AST-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6).toUpperCase()}`,
      status: 'active',
      created_at: Date.now(),
    };

    // undefined 제거
    const clean = Object.fromEntries(Object.entries(payload).filter(([,v]) => v !== undefined));

    const r = push(ref(db, 'assets'));
    await set(r, clean);
    existingCars.add(carNumber);
    ok++;

    if (ok % 20 === 0) console.log(`  진행: ${ok}건...`);
  }

  console.log(`\n완료: ${ok}건 저장 / ${dup}건 중복스킵 / ${skip}건 필수필드누락`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
