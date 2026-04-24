#!/usr/bin/env node
/**
 * 스킵된 16건을 실제 차종마스터(seed)로 normalizeAsset 돌려서 매칭되는지 검증.
 *
 * 사용:
 *   node scripts/test-normalize-16.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// TS 컴파일 없이 실행하려고 ts-node 대신, 핵심 로직을 .mjs 로 재정의.
// (asset-normalize.ts 와 동일하게 유지 — 변경 시 동기화 필요)
const MAKER_ALIAS = {
  hyundai: '현대', '현대자동차': '현대', '현대차': '현대',
  kia: '기아', '기아자동차': '기아', '기아차': '기아',
  genesis: '제네시스',
  bmw: 'BMW', benz: '벤츠', mercedes: '벤츠',
};
const MODEL_NAME_ALIAS = {
  '봉고3': '봉고III', '봉고iii': '봉고III', 'bongo3': '봉고III', 'bongoiii': '봉고III',
  '포터2': '포터II', '포터ii': '포터II', 'porter2': '포터II',
};
const MODEL_NUMBER_MAP = {
  // BMW
  '518': '5시리즈', '520': '5시리즈', '523': '5시리즈', '525': '5시리즈', '528': '5시리즈', '530': '5시리즈', '535': '5시리즈', '540': '5시리즈', '550': '5시리즈',
  '316': '3시리즈', '318': '3시리즈', '320': '3시리즈', '325': '3시리즈', '328': '3시리즈', '330': '3시리즈', '335': '3시리즈', '340': '3시리즈',
  '418': '4시리즈', '420': '4시리즈', '425': '4시리즈', '428': '4시리즈', '430': '4시리즈', '435': '4시리즈',
  '640': '6시리즈', '630': '6시리즈',
  // Mercedes
  c180: 'C-클래스', c200: 'C-클래스', c220: 'C-클래스', c250: 'C-클래스', c300: 'C-클래스',
  cls250: 'CLS-클래스', cls300: 'CLS-클래스', cls350: 'CLS-클래스',
  e200: 'E-클래스', e220: 'E-클래스', e250: 'E-클래스', e300: 'E-클래스', e350: 'E-클래스',
  s300: 'S-클래스', s350: 'S-클래스', s450: 'S-클래스', s500: 'S-클래스',
  glc200: 'GLC-클래스', glc220: 'GLC-클래스', glc300: 'GLC-클래스',
};
const BENZ_LETTERS = new Set(['A','B','C','E','S','V','G']);

const norm = (s) => String(s ?? '').trim();
const normLow = (s) => norm(s).toLowerCase().replace(/\s+/g, '');
const strongNorm = (s) => String(s ?? '').toLowerCase().replace(/[\s\-_·•‧/()[\]{}]+/g, '');

function normalizeModel(row, masters) {
  const data = { ...row };
  const messages = [];
  const activeMasters = masters.filter((m) => m.status !== 'deleted');
  const getModels = (maker) => [...new Set(activeMasters.filter((m) => m.maker === maker).map((m) => m.model).filter(Boolean))];

  // Maker 정규화
  const rawMfg = norm(data.manufacturer);
  const mfgLow = rawMfg.toLowerCase();
  if (MAKER_ALIAS[mfgLow]) { data.manufacturer = MAKER_ALIAS[mfgLow]; }

  if (!data.manufacturer) return { data, messages: ['NO MAKER'] };
  const models = getModels(data.manufacturer);
  if (models.length === 0) return { data, messages: [`no models for ${data.manufacturer}`] };

  // Model 정규화 — car_model 있으면 stripped 블록
  const makerLow = normLow(data.manufacturer);
  const raw = norm(data.car_model);
  let stripped = raw.replace(new RegExp('^' + makerLow + '[\\s\\-]*', 'i'), '').trim();
  if (!stripped || normLow(stripped) === makerLow) {
    // maker 별칭 try
    const aliases = Object.entries(MAKER_ALIAS).filter(([,v]) => v === data.manufacturer).map(([k]) => k);
    for (const alias of aliases) {
      const attempt = raw.replace(new RegExp('^' + alias + '[\\s\\-]*', 'i'), '').trim();
      if (attempt && normLow(attempt) !== normLow(raw)) { stripped = attempt; break; }
    }
  }

  let found = null;
  const tryNumberMap = (token) => {
    const t = strongNorm(token);
    const numKey = t.replace(/[dise]+$/, '');
    const target = MODEL_NUMBER_MAP[t] ?? MODEL_NUMBER_MAP[numKey];
    if (target && models.includes(target)) return target;
    return null;
  };

  if (stripped && normLow(stripped) !== makerLow) {
    if (models.includes(stripped)) found = stripped;
    const firstToken = stripped.trim().toLowerCase().split(/\s+/)[0] ?? '';
    if (!found) found = tryNumberMap(firstToken);
    if (found) messages.push(`stripped: "${raw}" → "${found}" (${firstToken})`);
  }

  // 역추론 — detail_model 사용
  if (!found && data.detail_model) {
    const subRaw = norm(data.detail_model).replace(new RegExp('^' + makerLow + '[\\s\\-]*', 'i'), '').trim();
    const subFirstToken = subRaw.toLowerCase().split(/\s+/)[0] ?? '';
    const subStrong = strongNorm(subRaw);

    // #2: MODEL_NAME_ALIAS exact
    if (!found && subFirstToken) {
      const aliasTarget = MODEL_NAME_ALIAS[subFirstToken] ?? MODEL_NAME_ALIAS[normLow(subRaw)] ?? MODEL_NAME_ALIAS[subStrong];
      if (aliasTarget && models.includes(aliasTarget)) found = aliasTarget;
    }
    // #3: MODEL_NAME_ALIAS prefix
    if (!found && subStrong) {
      for (const [aliasKey, target] of Object.entries(MODEL_NAME_ALIAS)) {
        if (subStrong.startsWith(strongNorm(aliasKey)) && models.includes(target)) { found = target; break; }
      }
    }
    // #4: MODEL_NUMBER_MAP
    if (!found) {
      const fromNumber = tryNumberMap(subFirstToken);
      if (fromNumber) found = fromNumber;
    }
    // #5: 벤츠 단일 글자
    if (!found && data.manufacturer === '벤츠' && subFirstToken.length === 1) {
      const letter = subFirstToken.toUpperCase();
      if (BENZ_LETTERS.has(letter) && models.includes(`${letter}-클래스`)) {
        found = `${letter}-클래스`;
      }
    }
    if (found) messages.push(`역추론: detail="${data.detail_model}" → "${found}" (firstToken=${subFirstToken})`);
  }

  if (found) data.car_model = found;
  else messages.push(`❌ 매칭 실패: maker=${data.manufacturer}, raw_model=${raw}, detail=${data.detail_model}`);

  return { data, messages };
}

async function main() {
  const seedPath = path.join(__dirname, 'vehicle-master-seed.json');
  const suppPath = path.join(__dirname, 'vehicle-master-cargo-supplement.json');
  const mastersMain = JSON.parse(await readFile(seedPath, 'utf8'));
  const mastersSupp = JSON.parse(await readFile(suppPath, 'utf8'));
  const masters = [...mastersMain, ...mastersSupp];
  console.log(`[seed] ${mastersMain.length}개 + supplement ${mastersSupp.length}개 = ${masters.length}개`);

  // 16 스킵 행 재현
  const testRows = [
    { car_number: '52수7832', manufacturer: '벤츠', car_model: '벤츠c 카브리올레', detail_model: '벤츠c 카브리올레', car_year: '2017' },
    { car_number: '36머9150', manufacturer: '벤츠', car_model: '벤츠C200', detail_model: 'C200', car_year: '2017' },
    { car_number: '263모3889', manufacturer: 'BMW', car_model: 'BMW530i', detail_model: 'BMW530i', car_year: '2017' },
    { car_number: '306조9919', manufacturer: 'BMW', car_model: 'BMW520d', detail_model: 'BMW520d', car_year: '2017' },
    { car_number: '109로1819', manufacturer: '벤츠', car_model: '벤츠S450', detail_model: '벤츠S450', car_year: '2017' },
    { car_number: '81소0566', manufacturer: '현대', car_model: '', detail_model: '포터 II', car_year: '2018' },
    { car_number: '28누9894', manufacturer: '벤츠', car_model: '', detail_model: 'GLC300', car_year: '2018' },
    { car_number: '97러0815', manufacturer: '기아', car_model: '', detail_model: '봉고III', car_year: '2018' },
    { car_number: '379우2017', manufacturer: '벤츠', car_model: '', detail_model: 'E300', car_year: '2018' },
    { car_number: '94주0700', manufacturer: '기아', car_model: '', detail_model: '봉고III', car_year: '2018' },
    { car_number: '155리6323', manufacturer: '벤츠', car_model: '', detail_model: 'CLS300', car_year: '2018' },
    { car_number: '145가1781', manufacturer: '벤츠', car_model: '', detail_model: 'E250', car_year: '2018' },
    { car_number: '145가1796', manufacturer: '벤츠', car_model: '', detail_model: 'E250', car_year: '2018' },
    { car_number: '155리6311', manufacturer: '벤츠', car_model: '', detail_model: 'E250', car_year: '2018' },
    { car_number: '155리6331', manufacturer: '벤츠', car_model: '', detail_model: 'E250', car_year: '2018' },
    { car_number: '827너3872', manufacturer: '현대', car_model: '', detail_model: '포터2내장탑차', car_year: '2019' },
  ];

  let matched = 0, failed = 0;
  console.log('\n━━━ 16건 매칭 결과 ━━━');
  for (const row of testRows) {
    const { data, messages } = normalizeModel(row, masters);
    const status = data.car_model ? '✅' : '❌';
    console.log(`${status} ${row.car_number.padEnd(10)} ${row.manufacturer.padEnd(4)} ${(row.detail_model || '').padEnd(25)} → ${data.car_model || '매칭실패'}`);
    for (const m of messages) console.log(`        ${m}`);
    if (data.car_model) matched++; else failed++;
  }
  console.log(`\n━━━ 최종: 매칭 ${matched}/${testRows.length}, 실패 ${failed}건 ━━━`);
}

main().catch((e) => { console.error(e); process.exit(1); });
