/**
 * 고객 포털(/my) API.
 *
 *   POST /api/my  { action: 'verify', car_number, identifier }
 *     → 차량번호 + 등록번호(주민/법인/사업/전화) 매칭 시 token + 전체 데이터
 *
 *   POST /api/my  { action: 'refresh', car_number, token }
 *     → 기존 토큰으로 재조회 (세션 연장 아님 — iat 유지)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import { issueToken, verifyToken, normalizeIdentifier } from '@/lib/my/portal-auth';
import { sanitizeCarNumber } from '@/lib/format-input';
import { isActiveContractStatus } from '@/lib/data/contract-status';

export const runtime = 'nodejs';

interface ContractLite {
  _key: string;
  contract_code?: string;
  contractor_name?: string;
  contractor_phone?: string;
  car_number?: string;
  start_date?: string;
  end_date?: string;
  rent_months?: number;
  rent_amount?: number;
  deposit_amount?: number;
  auto_debit_day?: string | number;
  product_type?: string;
  contract_status?: string;
  is_extension?: boolean;
  is_renewal?: boolean;
  contract_doc_urls?: string[];
  insurance_doc_urls?: string[];
  status?: string;
}

interface CustomerLite {
  _key: string;
  name?: string;
  phone?: string;
  resident_no?: string;
  business_no?: string;
  corp_no?: string;
  license_no?: string;
  birth?: string;
  status?: string;
}

interface BillingLite {
  _key: string;
  contract_code?: string;
  bill_count?: number;
  due_date?: string;
  amount?: number;
  paid_total?: number;
  status?: string;
  extra_kind?: string;
  derived_from?: string;
}

interface AssetLite {
  _key: string;
  car_number?: string;
  manufacturer?: string;
  car_model?: string;
  detail_model?: string;
  car_year?: string | number;
  fuel_type?: string;
  ext_color?: string;
  current_mileage?: string | number;
  first_registration_date?: string;
  vin?: string;
}

interface EventLite {
  _key: string;
  type?: string;
  date?: string;
  title?: string;
  car_number?: string;
  photo_urls?: string[];
  status?: string;
}

interface OcrDocLite {
  _key: string;
  doc_type?: string;
  doc_name?: string;
  car_number?: string;
  extracted?: Record<string, string>;
  raw_text?: string;
  created_at?: number;
  status?: string;
}

function snapshotToList<T>(val: unknown): T[] {
  if (!val || typeof val !== 'object') return [];
  return Object.entries(val as Record<string, unknown>).map(([k, v]) => ({
    _key: k,
    ...(v as Record<string, unknown>),
  })) as T[];
}

/** 차량번호로 계약 검색 */
async function findContractsByCar(carNumber: string): Promise<ContractLite[]> {
  const snap = await get(
    query(ref(getRtdb(), 'contracts'), orderByChild('car_number'), equalTo(carNumber)),
  );
  if (!snap.exists()) return [];
  return snapshotToList<ContractLite>(snap.val()).filter((c) => c.status !== 'deleted');
}

/** 계약자 이름으로 고객 검색 */
async function findCustomerByName(name: string): Promise<CustomerLite | null> {
  const snap = await get(
    query(ref(getRtdb(), 'customers'), orderByChild('name'), equalTo(name)),
  );
  if (!snap.exists()) return null;
  const list = snapshotToList<CustomerLite>(snap.val()).filter((c) => c.status !== 'deleted');
  return list[0] ?? null;
}

/** billings — contract_code로 조회 */
async function findBillingsByContract(code: string): Promise<BillingLite[]> {
  const snap = await get(
    query(ref(getRtdb(), 'billings'), orderByChild('contract_code'), equalTo(code)),
  );
  if (!snap.exists()) return [];
  return snapshotToList<BillingLite>(snap.val())
    .filter((b) => b.status !== 'deleted')
    .sort((a, b) => (a.bill_count ?? 0) - (b.bill_count ?? 0));
}

async function findAssetByCar(carNumber: string): Promise<AssetLite | null> {
  const snap = await get(
    query(ref(getRtdb(), 'assets'), orderByChild('car_number'), equalTo(carNumber)),
  );
  if (!snap.exists()) return null;
  const list = snapshotToList<AssetLite>(snap.val()).filter((a) => (a as { status?: string }).status !== 'deleted');
  return list[0] ?? null;
}

async function findEventsByCar(carNumber: string): Promise<EventLite[]> {
  const snap = await get(
    query(ref(getRtdb(), 'events'), orderByChild('car_number'), equalTo(carNumber)),
  );
  if (!snap.exists()) return [];
  return snapshotToList<EventLite>(snap.val())
    .filter((e) => e.status !== 'deleted')
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
}

async function findOcrDocsByCar(carNumber: string): Promise<OcrDocLite[]> {
  const snap = await get(
    query(ref(getRtdb(), 'ocr_documents'), orderByChild('car_number'), equalTo(carNumber)),
  );
  if (!snap.exists()) return [];
  return snapshotToList<OcrDocLite>(snap.val())
    .filter((d) => d.status !== 'deleted')
    .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
}

/** contract/customer 레코드에서 식별자 후보 모아 정규화된 Set 반환 */
function collectIdentifiers(contract: ContractLite, customer: CustomerLite | null): Set<string> {
  const set = new Set<string>();
  const add = (v?: string) => { const n = normalizeIdentifier(v || ''); if (n) set.add(n); };
  add(contract.contractor_phone);
  if (customer) {
    add(customer.phone);
    add(customer.resident_no);
    add(customer.business_no);
    add(customer.corp_no);
    // 전화번호 뒷 4자리만 매칭 허용 (SMS 부재 시 완화 조건)
    if (customer.phone) {
      const p = normalizeIdentifier(customer.phone);
      if (p.length >= 4) set.add(p.slice(-4));
    }
    if (contract.contractor_phone) {
      const p = normalizeIdentifier(contract.contractor_phone);
      if (p.length >= 4) set.add(p.slice(-4));
    }
  }
  return set;
}

function sanitizeContract(c: ContractLite) {
  return {
    _key: c._key,
    contract_code: c.contract_code,
    contractor_name: c.contractor_name,
    car_number: c.car_number,
    start_date: c.start_date,
    end_date: c.end_date,
    rent_months: c.rent_months,
    rent_amount: c.rent_amount,
    deposit_amount: c.deposit_amount,
    auto_debit_day: c.auto_debit_day,
    product_type: c.product_type,
    contract_status: c.contract_status,
    is_extension: c.is_extension,
    is_renewal: c.is_renewal,
    contract_doc_urls: c.contract_doc_urls ?? [],
    insurance_doc_urls: c.insurance_doc_urls ?? [],
  };
}

function sanitizeAsset(a: AssetLite | null) {
  if (!a) return null;
  return {
    car_number: a.car_number,
    manufacturer: a.manufacturer,
    car_model: a.car_model,
    detail_model: a.detail_model,
    car_year: a.car_year,
    fuel_type: a.fuel_type,
    ext_color: a.ext_color,
    current_mileage: a.current_mileage,
    first_registration_date: a.first_registration_date,
  };
}

function sanitizeBilling(b: BillingLite) {
  return {
    bill_count: b.bill_count,
    due_date: b.due_date,
    amount: b.amount,
    paid_total: b.paid_total,
    status: b.status,
    extra_kind: b.extra_kind,
    derived_from: b.derived_from,
  };
}

function docsPayload(events: EventLite[], ocrDocs: OcrDocLite[], contract: ContractLite) {
  const insEvents = events.filter((e) => e.type === 'insurance' && (e.photo_urls?.length ?? 0) > 0);
  const insurance = insEvents[0]?.photo_urls ?? contract.insurance_doc_urls ?? [];
  const contractDocs = contract.contract_doc_urls ?? [];
  const registrationDoc = ocrDocs.find((d) => d.doc_type === '자동차등록증');
  const insuranceDoc = ocrDocs.find((d) => d.doc_type === '보험증권');
  const others = ocrDocs.filter(
    (d) => d.doc_type !== '자동차등록증' && d.doc_type !== '보험증권',
  );
  return {
    contract_docs: contractDocs,
    insurance_photos: insurance,
    registration: registrationDoc
      ? { doc_name: registrationDoc.doc_name, extracted: registrationDoc.extracted ?? {}, raw_text: registrationDoc.raw_text }
      : null,
    insurance_ocr: insuranceDoc
      ? { doc_name: insuranceDoc.doc_name, extracted: insuranceDoc.extracted ?? {}, raw_text: insuranceDoc.raw_text }
      : null,
    other_ocr_docs: others.map((d) => ({
      doc_type: d.doc_type,
      doc_name: d.doc_name,
      created_at: d.created_at,
    })),
  };
}

async function buildPayload(contract: ContractLite) {
  const [billings, asset, events, ocrDocs] = await Promise.all([
    contract.contract_code ? findBillingsByContract(contract.contract_code) : Promise.resolve([] as BillingLite[]),
    contract.car_number ? findAssetByCar(contract.car_number) : Promise.resolve(null),
    contract.car_number ? findEventsByCar(contract.car_number) : Promise.resolve([] as EventLite[]),
    contract.car_number ? findOcrDocsByCar(contract.car_number) : Promise.resolve([] as OcrDocLite[]),
  ]);
  return {
    contract: sanitizeContract(contract),
    asset: sanitizeAsset(asset),
    billings: billings.map(sanitizeBilling),
    docs: docsPayload(events, ocrDocs, contract),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'verify');

    const rawCar = String(body?.car_number || '').trim();
    if (!rawCar) {
      return NextResponse.json({ ok: false, error: '차량번호 필요' }, { status: 400 });
    }
    const carNumber = sanitizeCarNumber(rawCar);

    if (action === 'refresh') {
      const token = String(body?.token || '');
      const v = verifyToken(token, carNumber);
      if (!v) {
        return NextResponse.json({ ok: false, error: '세션 만료' }, { status: 401 });
      }
      const contracts = await findContractsByCar(carNumber);
      const main =
        contracts.find((c) => isActiveContractStatus(c.contract_status)) ??
        contracts.sort((a, b) => String(b.start_date ?? '').localeCompare(String(a.start_date ?? '')))[0];
      if (!main) {
        return NextResponse.json({ ok: false, error: '계약 없음' }, { status: 404 });
      }
      const payload = await buildPayload(main);
      return NextResponse.json({ ok: true, ...payload });
    }

    // verify
    const identifier = normalizeIdentifier(String(body?.identifier || ''));
    if (!identifier) {
      return NextResponse.json({ ok: false, error: '등록번호 필요' }, { status: 400 });
    }

    const contracts = await findContractsByCar(carNumber);
    if (contracts.length === 0) {
      return NextResponse.json({ ok: false, error: '해당 차량 계약을 찾을 수 없음' }, { status: 404 });
    }

    let matched: ContractLite | null = null;
    for (const c of contracts) {
      const customer = c.contractor_name ? await findCustomerByName(c.contractor_name) : null;
      const ids = collectIdentifiers(c, customer);
      if (ids.has(identifier)) {
        matched = c;
        break;
      }
    }
    if (!matched) {
      return NextResponse.json({ ok: false, error: '등록번호 불일치' }, { status: 401 });
    }

    const token = issueToken(carNumber);
    const payload = await buildPayload(matched);
    return NextResponse.json({ ok: true, token, ...payload });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
