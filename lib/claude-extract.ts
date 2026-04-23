/**
 * Claude Vision 기반 문서 추출 클라이언트 — Next.js API route `/api/ocr/extract`를 호출.
 *
 * 사용 예:
 *   const reg = await extractVehicleReg(file);   // 자동차등록증
 *   const biz = await extractBusinessReg(file);  // 사업자등록증
 */

export type DocType = 'vehicle_reg' | 'business_reg';

export interface ClaudeExtractResponse<T = Record<string, unknown>> {
  ok: boolean;
  doc_type?: string;
  doc_label?: string;
  extracted?: T;
  model?: string;
  usage?: { input_tokens: number; output_tokens: number };
  error?: string;
}

export interface VehicleRegExtracted {
  car_number: string | null;
  car_name: string | null;
  // 차종마스터 매칭 (Gemini가 컨텍스트 보고 직접 선택)
  manufacturer: string | null;
  car_model: string | null;
  detail_model: string | null;
  // 나머지
  vin: string | null;
  type_number: string | null;
  engine_type: string | null;
  car_year: number | null;
  first_registration_date: string | null;
  category_hint: string | null;
  usage_type: string | null;
  displacement: number | null;
  seats: number | null;
  fuel_type: string | null;
  owner_name: string | null;
  owner_biz_no: string | null;
  address: string | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  gross_weight_kg: number | null;
}

export interface BusinessRegExtracted {
  biz_no: string | null;
  corp_no: string | null;
  partner_name: string | null;
  ceo: string | null;
  open_date: string | null;
  address: string | null;
  hq_address: string | null;
  industry: string | null;
  category: string | null;
  email: string | null;
  entity_type: 'corporate' | 'individual';
}

interface MasterEntry {
  maker?: string;
  model?: string;
  sub?: string;
  origin?: string;
  category?: string;
  production_start?: string;
  production_end?: string;
  year_start?: string | number;
  year_end?: string | number;
  archived?: boolean;
}

async function callExtract<T>(
  file: File,
  type: DocType,
  master?: MasterEntry[],
): Promise<ClaudeExtractResponse<T>> {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);
  if (master && master.length > 0) {
    form.append('master', JSON.stringify(master));
  }
  const res = await fetch('/api/ocr/extract', { method: 'POST', body: form });
  const json = (await res.json()) as ClaudeExtractResponse<T>;
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}

export function extractVehicleReg(
  file: File,
  master?: MasterEntry[],
): Promise<ClaudeExtractResponse<VehicleRegExtracted>> {
  return callExtract<VehicleRegExtracted>(file, 'vehicle_reg', master);
}

export function extractBusinessReg(file: File): Promise<ClaudeExtractResponse<BusinessRegExtracted>> {
  return callExtract<BusinessRegExtracted>(file, 'business_reg');
}
