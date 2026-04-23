/**
 * Google Gemini 기반 문서 구조화 추출 엔드포인트.
 *
 *   POST /api/ocr/extract  (multipart/form-data)
 *     - file: File (PDF | JPG | PNG)
 *     - type: 'vehicle_reg' | 'business_reg'
 *
 *   → { ok: true, extracted: { ... }, model: 'gemini-2.5-flash' }
 *
 * 서버 사이드에서만 돌며 `GEMINI_API_KEY` 환경변수 필요.
 * 무료 티어: 분당 15회 · 일 1,500회.
 *
 * 503/429 에러는 자동 재시도 (최대 3회, exponential backoff).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 120;

// gemini-2.5-flash: 현행 주력 모델. 유료 Tier 1 기준 분당 1,000회, 일 10K건.
// 한국 정부 서식 정확도 최상, 속도 적당.
const MODEL = 'gemini-2.5-flash';

// ───────── 추출 스키마 ─────────

const VEHICLE_REG_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    car_number: { type: Type.STRING, nullable: true, description: '차량번호 (예: 12가3456)' },
    car_name: { type: Type.STRING, nullable: true, description: '차명 원본 (등록증에 적힌 그대로)' },
    // 차종마스터 매칭 결과 — Gemini가 컨텍스트 보고 직접 선택
    manufacturer: { type: Type.STRING, nullable: true, description: '제조사 — 차종마스터 maker 컬럼값과 정확히 일치' },
    car_model: { type: Type.STRING, nullable: true, description: '모델 — 차종마스터 model 컬럼값과 정확히 일치' },
    detail_model: { type: Type.STRING, nullable: true, description: '세부모델 — 차종마스터 sub 컬럼값과 정확히 일치' },
    // 나머지
    vin: { type: Type.STRING, nullable: true, description: '차대번호 17자' },
    type_number: { type: Type.STRING, nullable: true, description: '형식번호 (예: JA51BA-T6-P)' },
    engine_type: { type: Type.STRING, nullable: true, description: '원동기형식' },
    car_year: { type: Type.INTEGER, nullable: true, description: '제작연도 4자리' },
    first_registration_date: { type: Type.STRING, nullable: true, description: '최초등록일 YYYY-MM-DD' },
    category_hint: { type: Type.STRING, nullable: true, description: '차종' },
    usage_type: { type: Type.STRING, nullable: true, description: '용도' },
    displacement: { type: Type.INTEGER, nullable: true, description: '배기량 cc. 전기차는 null' },
    seats: { type: Type.INTEGER, nullable: true, description: '승차정원' },
    fuel_type: { type: Type.STRING, nullable: true, description: '연료' },
    owner_name: { type: Type.STRING, nullable: true, description: '소유자' },
    owner_biz_no: { type: Type.STRING, nullable: true, description: '법인등록번호' },
    address: { type: Type.STRING, nullable: true, description: '사용본거지' },
    length_mm: { type: Type.INTEGER, nullable: true },
    width_mm: { type: Type.INTEGER, nullable: true },
    height_mm: { type: Type.INTEGER, nullable: true },
    gross_weight_kg: { type: Type.INTEGER, nullable: true },
  },
  required: [
    'car_number', 'car_name', 'manufacturer', 'car_model', 'detail_model',
    'vin', 'type_number', 'engine_type', 'car_year',
    'first_registration_date', 'category_hint', 'usage_type', 'displacement',
    'seats', 'fuel_type', 'owner_name', 'owner_biz_no', 'address',
    'length_mm', 'width_mm', 'height_mm', 'gross_weight_kg',
  ],
};

const BUSINESS_REG_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    biz_no: { type: Type.STRING, nullable: true, description: '사업자등록번호 XXX-XX-XXXXX' },
    corp_no: { type: Type.STRING, nullable: true, description: '법인등록번호' },
    partner_name: { type: Type.STRING, nullable: true, description: '법인명/상호' },
    ceo: { type: Type.STRING, nullable: true, description: '대표자' },
    open_date: { type: Type.STRING, nullable: true, description: '개업일 YYYY-MM-DD' },
    address: { type: Type.STRING, nullable: true },
    hq_address: { type: Type.STRING, nullable: true },
    industry: { type: Type.STRING, nullable: true },
    category: { type: Type.STRING, nullable: true },
    email: { type: Type.STRING, nullable: true },
    entity_type: { type: Type.STRING, enum: ['corporate', 'individual'] },
  },
  required: [
    'biz_no', 'corp_no', 'partner_name', 'ceo', 'open_date', 'address',
    'hq_address', 'industry', 'category', 'email', 'entity_type',
  ],
};

interface TypeSpec {
  label: string;
  prompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any;
}

const TYPE_SPECS: Record<string, TypeSpec> = {
  vehicle_reg: {
    label: '자동차등록증',
    prompt: `이 문서는 한국 자동차등록증입니다 (자동차등록규칙 별지 제1호서식). 각 필드 앞에 원형 숫자(① ② ③ ...)가 붙어 있습니다.

## 차량번호 추출 (car_number) — 가장 중요

**반드시 다음 포맷에만 맞는 값을 반환**: \`\\d{2,3}[가-힣]\\d{4}\` (숫자 2~3자리 + 한글 1자 + 숫자 4자리)

### ✅ 올바른 예시
- \`01도9893\`, \`12가3456\`, \`123하4567\`, \`15가4481\`, \`02마4731\`

### 🚫 차량번호 아님 — 절대 car_number에 넣지 말 것

등록증 상단의 이런 값들은 **문서번호**이며 **차량번호가 아닙니다**:
- \`202512-039861\` ← 하이픈 포함, 한글 없음 → 문서번호임
- \`202512-039751\` ← 하이픈 포함, 한글 없음 → 문서번호임
- \`5851995513790711\` ← 16자리 숫자만 → 문서확인번호임
- \`A01-1-00062-0019-1416\` ← A로 시작 → 제원관리번호임
- \`JA51BA-T6-P\` ← 영문 + 하이픈 → 형식번호임
- \`110111-8596368\` ← 법인등록번호
- \`5YJ3E1EB0LF695181\` ← 차대번호(VIN, 17자)

**중요 규칙**: 값에 **한글이 없거나** 하이픈이 있거나 17자인 경우 → **절대 car_number로 선택하지 마세요**.

오직 ①번 칸 "자동차등록번호" 라벨 바로 옆에 있는, 정확히 "숫자+한글+숫자" 형태의 값만 추출하세요. 그런 값이 없으면 \`null\`.

## 기타 필드

- **차대번호(VIN)**: 정확히 17자. I/O/Q 제외. ⑥번 칸.
- **차명(car_name)**: 등록증 ④번 칸 그대로.
- **제조사(manufacturer)**: 차명/VIN으로 판단. 한글로 ("현대", "기아", "벤츠", "BMW", "테슬라", "지프" 등). 영문은 변환 (Mercedes→벤츠, Jeep→지프).
- **모델(car_model)**: 차명에서 모델 그룹만 추출. 예: "더 뉴 아반떼(CN7)" → "아반떼", "K5 2세대" → "K5", "Model 3" → "모델 3", "G80" → "G80". 세대/코드/괄호는 제거.
- **세부모델(detail_model)**: 차명 원문 그대로 (등록증 ④ 텍스트). 세대/코드/괄호 유지. 예: "아반떼(CN7)" → "아반떼(CN7)". 차명이 단순하면 그냥 모델명.
- **형식번호**: 영문+숫자+하이픈 (예: JA51BA-T6-P). ⑤번 칸.
- **제작연월**: YYYY-MM. 연도만 car_year.
- **연료**: "휘발유" → "가솔린", "경유" → "디젤".
- **배기량**: cc 숫자만. 전기차는 null.
- **용도**: 차량번호 한글이 '하'/'허'/'호'면 렌터카.
- **소유자(owner_name)**: ⑨번 칸. "스위치플랜(주)" 같은 법인명 그대로 유지 — 괄호/접미어 제거하지 말 것.
- **owner_biz_no**: ⑩번 칸 "법인등록번호". 법인이 아니면(개인 소유) null. 형식: "XXXXXX-XXXXXXX" 13자리.

### 제조사/모델 판별 특수 케이스
- G70/G80/G90/GV60/GV70/GV80/EQ900 → 제네시스 (현대 아님)
- Model 3/S/X/Y → 테슬라
- 랭글러/체로키/그랜드체로키/어벤저/레니게이드/컴패스/글래디에이터 → 지프
- 911/카이엔/마칸/파나메라/타이칸 → 포르쉐

값이 없으면 null.`,
    schema: VEHICLE_REG_SCHEMA,
  },
  business_reg: {
    label: '사업자등록증',
    prompt: `이 문서는 한국 사업자등록증입니다.

- **사업자등록번호**: XXX-XX-XXXXX 형식.
- **법인등록번호**: XXXXXX-XXXXXXX. 개인사업자는 null.
- **법인명/상호**: 괄호 안 영문 제외 (예: "스위치플랜 주식회사 (Switch Plan Co.,Ltd)" → "스위치플랜 주식회사")
- **대표자**: 한글 이름만.
- **개업연월일**: YYYY-MM-DD.
- **업태/종목**: 여러 개면 콤마 연결.
- **entity_type**: "법인사업자" → corporate, "개인사업자" → individual.

없으면 null.`,
    schema: BUSINESS_REG_SCHEMA,
  },
};

// ───────── 핸들러 ─────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'GEMINI_API_KEY 환경변수 미설정' },
      { status: 500 },
    );
  }

  let docType: string | null;
  let file: File | null;
  let masterJson: string | null;
  try {
    const formData = await req.formData();
    docType = String(formData.get('type') || '');
    file = formData.get('file') as File | null;
    masterJson = formData.get('master') as string | null; // 선택적 — vehicle_master 컨텍스트
  } catch (err) {
    return NextResponse.json({ ok: false, error: `FormData 파싱 실패: ${(err as Error).message}` }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ ok: false, error: 'file 필드 누락' }, { status: 400 });
  }
  const spec = TYPE_SPECS[docType ?? ''];
  if (!spec) {
    return NextResponse.json({ ok: false, error: `지원하지 않는 type: ${docType}` }, { status: 400 });
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: '파일 크기는 20MB 이하만 가능' }, { status: 413 });
  }

  // 차량등록증이면 vehicle_master 컨텍스트를 프롬프트에 삽입 → Gemini가 직접 매칭
  let contextualPrompt = spec.prompt;
  if (docType === 'vehicle_reg' && masterJson) {
    try {
      const masters = JSON.parse(masterJson) as Array<Record<string, unknown>>;
      if (Array.isArray(masters) && masters.length > 0) {
        // archived 제외 + 핵심 필드만 추려서 전달 (토큰 절약)
        const compact = masters
          .filter((m) => !m.archived)
          .map((m) => {
            const entry: Record<string, unknown> = {
              maker: m.maker,
              model: m.model,
              sub: m.sub,
            };
            if (m.origin) entry.origin = m.origin;
            if (m.category) entry.category = m.category;
            if (m.production_start) entry.prod_s = m.production_start;
            if (m.production_end) entry.prod_e = m.production_end;
            return entry;
          });
        contextualPrompt = `${spec.prompt}

## 🎯 핵심 규칙 — 차종마스터 매칭

아래는 우리 시스템의 **차종마스터** 입니다. 각 엔트리는 다음 필드를 가집니다:
- \`maker\`: 제조사 (예: "현대", "BMW")
- \`model\`: 모델 그룹 (예: "아반떼", "5시리즈")
- \`sub\`: **세부모델 = 등록증 ④ 차명과 매칭** (예: "아반떼 (CN7)")
- \`prod_s\` / \`prod_e\`: 생산 시작/종료 연월 ("2020-01" / "현재")
- \`category\`: 차종구분 ("준중형차", "중형 SUV" 등)
- \`origin\`: "국산" | "수입"

### ⭐ 매칭 원칙

1. **등록증 ④ 차명 + 제작연월**을 이용해 가장 적합한 \`sub\` 엔트리 선택
   - 차명 텍스트가 \`sub\`에 포함되거나 정확히 일치
   - 제작연월이 \`prod_s\` ~ \`prod_e\` 범위 안 (prod_e == "현재"는 상한 없음)
2. \`detail_model = 선택한 엔트리의 sub\` (마스터 표기 그대로, 등록증 원문 아님)
3. \`car_model = 선택한 엔트리의 model\`, \`manufacturer = maker\`
4. 매칭 실패 시에만 등록증 원문(car_name)을 detail_model에 넣고 car_model/manufacturer는 best guess

### 예시

| 등록증 차명 | 제작연월 | 매칭 결과 (detail_model) |
|-----------|---------|-----------------------|
| "아반떼(CN7)" | 2022-03 | "아반떼 (CN7)" (prod_s=2020-01, prod_e=현재) |
| "아반떼" | 2017-11 | "아반떼 AD" (prod_s=2015, prod_e=2018) |
| "Model 3" | 2021-06 | "Model 3" 또는 "모델 3" — 마스터 sub 값 그대로 |

### 영어/한글 매핑
- Jeep → 지프, Tesla → 테슬라, Mercedes → 벤츠, BMW → BMW
- G70/G80/G90/GV70/GV80/EQ900 → 제네시스

### 차종마스터 (${compact.length}건)
\`\`\`json
${JSON.stringify(compact)}
\`\`\`
`;
      }
    } catch (err) {
      console.warn('master JSON 파싱 실패:', err);
    }
  }

  const arrayBuf = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString('base64');
  const mediaType = file.type || inferMediaTypeFromName(file.name);

  const ai = new GoogleGenAI({ apiKey });

  // 503(과부하) / 429(rate limit) 자동 재시도 — 최대 3회, exponential backoff
  async function callWithRetry(): Promise<Awaited<ReturnType<typeof ai.models.generateContent>>> {
    const maxRetries = 3;
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await ai.models.generateContent({
          model: MODEL,
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType: mediaType, data: base64 } },
              { text: contextualPrompt },
            ],
          }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: spec.schema,
            temperature: 0,
            // thinkingConfig 는 2.5 모델만 지원 — 2.0-flash에서는 보낼 필요 없음
            ...(MODEL.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            maxOutputTokens: 2048,
          },
        });
      } catch (err) {
        lastErr = err;
        const msg = (err as { message?: string })?.message ?? '';
        const isRetryable = msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE') || msg.includes('RESOURCE_EXHAUSTED');
        if (!isRetryable || attempt === maxRetries - 1) throw err;
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 8000) + Math.random() * 1000;
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    throw lastErr;
  }

  try {
    const response = await callWithRetry();

    const text = response.text;
    if (!text) {
      return NextResponse.json({ ok: false, error: 'Gemini 응답에 텍스트 없음' }, { status: 502 });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `JSON 파싱 실패: ${(err as Error).message}`, raw: text },
        { status: 502 },
      );
    }

    // ── 후처리 검증: 문서번호/법인번호 같은 garbage를 차량번호로 잡은 경우 제거 ──
    if (docType === 'vehicle_reg' && parsed.car_number && typeof parsed.car_number === 'string') {
      const cn = parsed.car_number;
      const hasKorean = /[가-힣]/.test(cn);
      const validFormat = /^\d{2,3}[가-힣]\d{4}$/.test(cn.replace(/[\s-]/g, ''));
      if (!hasKorean || !validFormat) {
        parsed.car_number = null;
      } else {
        parsed.car_number = cn.replace(/[\s-]/g, '');
      }
    }

    // ── detail_model 폴백: 비어있으면 car_name 그대로 사용 (null 금지 규칙) ──
    if (docType === 'vehicle_reg' && !parsed.detail_model && parsed.car_name) {
      // 영문 괄호 제거: "아반떼(AVANTE)" → "아반떼"
      const cleanedName = String(parsed.car_name).replace(/\s*\([^)]*\)/g, '').trim();
      if (cleanedName) {
        parsed.detail_model = cleanedName;
      }
    }

    return NextResponse.json({
      ok: true,
      doc_type: docType,
      doc_label: spec.label,
      extracted: parsed,
      model: MODEL,
      usage: {
        input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
        output_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      },
    });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    const msg = e.message || String(err);
    const status = typeof e.status === 'number' ? e.status : 500;
    return NextResponse.json({ ok: false, error: `Gemini API 실패: ${msg}` }, { status });
  }
}

function inferMediaTypeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}
