/**
 * freepass.ts — freepasserp3 Firebase 연동 (상품 공유).
 * jpkerp ↔ freepasserp3 products 컬렉션 양방향 동기화.
 *
 * 주요 함수:
 *   - upsertProductToFreepass(product)        신규 추가 또는 기존 업데이트
 *   - findProductByCarNumber(carNumber)       차량번호로 기존 상품 조회
 *   - syncVehicleStatus(carNumber, status)    상품 상태만 변경 (출고가능/계약중/반납대기 등)
 *   - deactivateProductByCarNumber(carNumber) 상품 비활성화 (매각·폐차 시)
 */
import { initializeApp, getApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  update,
  push,
  get,
  query,
  orderByChild,
  equalTo,
  serverTimestamp,
} from 'firebase/database';

const FP_CONFIG = {
  apiKey: 'AIzaSyA0q_6yo9YRkpNeNaawH1AFPZx1IMgj-dY',
  authDomain: 'freepasserp3.firebaseapp.com',
  databaseURL: 'https://freepasserp3-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'freepasserp3',
  storageBucket: 'freepasserp3.firebasestorage.app',
  messagingSenderId: '172664197996',
  appId: '1:172664197996:web:91b7219f22eb68b5005949',
};

const FP_APP_NAME = 'freepass';

function getFpApp() {
  try {
    return getApp(FP_APP_NAME);
  } catch {
    return initializeApp(FP_CONFIG, FP_APP_NAME);
  }
}
export function getFpDb() {
  return getDatabase(getFpApp());
}

export interface FreepassProduct {
  car_number: string;
  partner_code?: string;
  partner_name?: string;
  maker?: string;
  model_name?: string;
  sub_model?: string;
  trim_name?: string;
  fuel_type?: string;
  ext_color?: string;
  int_color?: string;
  year?: string | number;
  options?: string;
  vehicle_price?: number;
  mileage?: number;
  product_type?: string;
  first_registration_date?: string;
  vehicle_age_expiry_date?: string;
  price?: Record<string, { rent?: number; deposit?: number }>;
  image_urls?: string[];
  note?: string;
}

export type VehicleStatus = '출고가능' | '계약중' | '반납대기' | '정비중' | '매각' | '비활성';

/** 차량번호로 기존 상품 검색 */
export async function findProductByCarNumber(carNumber: string) {
  const snap = await get(
    query(ref(getFpDb(), 'products'), orderByChild('car_number'), equalTo(carNumber)),
  );
  if (!snap.exists()) return null;
  const entries = Object.entries(snap.val() as Record<string, { created_at?: number }>);
  const sorted = entries.sort((a, b) => (b[1].created_at ?? 0) - (a[1].created_at ?? 0));
  return { uid: sorted[0][0], ...(sorted[0][1] as Record<string, unknown>) };
}

function buildProductPayload(product: FreepassProduct, productUid: string, productCode: string) {
  const p48 = product.price?.['48'] ?? {};
  return {
    product_uid: productUid,
    product_code: productCode,
    car_number: String(product.car_number || '').trim(),
    partner_code: String(product.partner_code || '').trim(),
    provider_company_code: String(product.partner_code || '').trim(),
    provider_name: product.partner_name ?? '',
    vehicle_status: '출고가능',
    product_type: product.product_type ?? '중고렌트',
    maker: product.maker ?? '',
    model_name: product.model_name ?? '',
    sub_model: product.sub_model ?? '',
    trim_name: product.trim_name ?? '',
    fuel_type: product.fuel_type ?? '',
    vehicle_price: Number(product.vehicle_price) || 0,
    mileage: Number(product.mileage) || 0,
    year: product.year ?? '',
    ext_color: product.ext_color ?? '',
    int_color: product.int_color ?? '',
    first_registration_date: product.first_registration_date ?? '',
    vehicle_age_expiry_date: product.vehicle_age_expiry_date ?? '',
    options: product.options ?? '',
    partner_memo: product.note ?? '',
    note: product.note ?? '',
    price: product.price ?? {},
    rental_price_48: Number(p48.rent) || 0,
    deposit_48: Number(p48.deposit) || 0,
    rental_price: Number(p48.rent) || 0,
    deposit: Number(p48.deposit) || 0,
    image_urls: product.image_urls ?? [],
    image_url: (product.image_urls ?? [])[0] ?? '',
    image_count: (product.image_urls ?? []).length,
    source: 'jpkerp4',
  };
}

/**
 * freepasserp3 products에 upsert (차량번호 기준).
 * 기존 상품 있으면 **필드 업데이트 + updated_at만 갱신**, 없으면 새로 push.
 */
export async function upsertProductToFreepass(
  product: FreepassProduct,
): Promise<{ productUid: string; productCode: string; created: boolean }> {
  const carNumber = String(product.car_number || '').trim();
  if (!carNumber) throw new Error('차량번호 필수');

  const partnerCode = String(product.partner_code || '').trim();
  const productCode = `${carNumber}-${partnerCode || 'JPK'}`;

  const existing = await findProductByCarNumber(carNumber);

  if (existing) {
    const uid = existing.uid;
    const payload = buildProductPayload(product, uid, productCode);
    await update(ref(getFpDb(), `products/${uid}`), {
      ...payload,
      updated_at: serverTimestamp(),
    });
    return { productUid: uid, productCode, created: false };
  }

  const pushRef = push(ref(getFpDb(), 'products'));
  const productUid = pushRef.key!;
  const payload = buildProductPayload(product, productUid, productCode);
  await set(ref(getFpDb(), `products/${productUid}`), {
    ...payload,
    created_at: Date.now(),
    updated_at: serverTimestamp(),
  });
  return { productUid, productCode, created: true };
}

/** Deprecated alias — 기존 호출 호환. 내부적으로 upsert. */
export async function saveProductToFreepass(product: FreepassProduct) {
  const { productUid, productCode } = await upsertProductToFreepass(product);
  return { productUid, productCode };
}

/** 상품 상태만 변경 — 계약 체결 시 '계약중', 반납 시 '반납대기' 등 */
export async function syncVehicleStatus(carNumber: string, status: VehicleStatus): Promise<boolean> {
  const existing = await findProductByCarNumber(carNumber);
  if (!existing) return false;
  await update(ref(getFpDb(), `products/${existing.uid}`), {
    vehicle_status: status,
    updated_at: serverTimestamp(),
  });
  return true;
}

/** 매각·폐차 시 비활성화 (삭제 아님 — 히스토리 유지) */
export async function deactivateProductByCarNumber(carNumber: string): Promise<boolean> {
  return syncVehicleStatus(carNumber, '비활성');
}
