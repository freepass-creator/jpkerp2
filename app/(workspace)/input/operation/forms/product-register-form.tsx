'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { OpFormBase } from '../op-form-base';
import { Field, TextInput, NumberInput, TextArea } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { saveProductToFreepass } from '@/lib/firebase/freepass';
import { useAssetByCar } from '@/lib/hooks/useLookups';
import { useOpContext } from '../op-context-store';

const PRODUCT_TYPES = ['중고렌트', '신차렌트', '단기렌트', '월렌트', '리스'];

export function ProductRegisterForm() {
  const [productType, setProductType] = useState('중고렌트');
  const [price, setPrice] = useState('');
  const [mileage, setMileage] = useState('');
  const { carNumber } = useOpContext();
  const asset = useAssetByCar(carNumber);

  return (
    <OpFormBase
      eventType="product_register"
      uploaderLabel="상품 사진"
      buildPayload={(d) => ({
        type: 'product',
        title: `상품등록 · ${productType}`,
        product_type: productType,
        vehicle_price: Number(String(price).replace(/,/g, '')) || 0,
        mileage: Number(String(mileage).replace(/,/g, '')) || undefined,
        rent_12: Number(String(d.rent_12 ?? '').replace(/,/g, '')) || undefined,
        rent_24: Number(String(d.rent_24 ?? '').replace(/,/g, '')) || undefined,
        rent_36: Number(String(d.rent_36 ?? '').replace(/,/g, '')) || undefined,
        rent_48: Number(String(d.rent_48 ?? '').replace(/,/g, '')) || undefined,
        rent_60: Number(String(d.rent_60 ?? '').replace(/,/g, '')) || undefined,
        deposit_48: Number(String(d.deposit_48 ?? '').replace(/,/g, '')) || undefined,
        memo: d.memo,
      })}
      afterSave={async (_eventKey, payload) => {
        // freepasserp3에 product push
        if (!asset) return;
        try {
          const p = payload as Record<string, number | string | undefined> & { photo_urls?: string[] };
          const { productCode } = await saveProductToFreepass({
            car_number: asset.car_number ?? '',
            partner_code: asset.partner_code,
            maker: asset.manufacturer,
            model_name: asset.car_model,
            sub_model: asset.detail_model,
            fuel_type: asset.fuel_type,
            ext_color: asset.ext_color,
            year: asset.car_year,
            first_registration_date: asset.first_registration_date,
            product_type: productType,
            vehicle_price: Number(price.replace(/,/g, '')) || 0,
            mileage: Number(mileage.replace(/,/g, '')) || 0,
            price: {
              '12': { rent: Number(p.rent_12) || 0 },
              '24': { rent: Number(p.rent_24) || 0 },
              '36': { rent: Number(p.rent_36) || 0 },
              '48': { rent: Number(p.rent_48) || 0, deposit: Number(p.deposit_48) || 0 },
              '60': { rent: Number(p.rent_60) || 0 },
            },
            image_urls: p.photo_urls ?? [],
            note: String(p.memo ?? ''),
          });
          toast.success(`freepasserp 등록 완료 (${productCode})`);
        } catch (e) {
          toast.error(`freepasserp 동기화 실패: ${(e as Error).message}`);
        }
      }}
    >
      <div className="form-section-title">
        <i className="ph ph-storefront" />상품 등록 (휴차 → 상품대기)
      </div>

      <div className="form-grid">
        <Field label="상품 구분" required span={3}>
          <BtnGroup value={productType} onChange={setProductType} options={PRODUCT_TYPES} />
        </Field>
        <Field label="차량가격">
          <NumberInput value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
        </Field>
        <Field label="주행거리 (km)">
          <NumberInput value={mileage} onChange={(e) => setMileage(e.target.value)} />
        </Field>
      </div>

      <div className="form-section-title" style={{ marginTop: 16 }}>
        <i className="ph ph-currency-krw" />대여 조건 (기간별 월 렌트)
      </div>
      <div className="form-grid">
        <Field label="12개월"><NumberInput name="rent_12" placeholder="0" /></Field>
        <Field label="24개월"><NumberInput name="rent_24" placeholder="0" /></Field>
        <Field label="36개월"><NumberInput name="rent_36" placeholder="0" /></Field>
        <Field label="48개월"><NumberInput name="rent_48" placeholder="0" /></Field>
        <Field label="60개월"><NumberInput name="rent_60" placeholder="0" /></Field>
        <Field label="보증금 (48월 기준)"><NumberInput name="deposit_48" placeholder="0" /></Field>
      </div>

      <div className="form-section-title" style={{ marginTop: 16 }}>
        <i className="ph ph-note" />추가 정보
      </div>
      <div className="form-grid">
        <Field label="메모" span={3}>
          <TextArea name="memo" rows={3} placeholder="특이사항·옵션" />
        </Field>
      </div>

      <div
        className="text-xs text-text-muted"
        style={{ padding: 12, background: 'var(--c-bg-sub)', borderRadius: 2, marginTop: 12 }}
      >
        💡 등록 시 로컬 events + freepasserp3 products 컬렉션에 동시 저장됩니다.
      </div>
    </OpFormBase>
  );
}
