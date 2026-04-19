'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ref as rtdbRef, update, serverTimestamp } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import { OpFormBase } from '../op-form-base';
import { Field, TextInput, NumberInput, TextArea, PhoneInput } from '@/components/form/field';
import { BtnGroup } from '@/components/form/btn-group';
import { FavChips } from '@/components/form/fav-chips';
import { useLocations, useLastFrom } from '@/lib/hooks/useOpPrefs';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import { useAssetByCar, useContractByCar } from '@/lib/hooks/useLookups';
import { useOpContext } from '../op-context-store';
import { syncVehicleStatus } from '@/lib/firebase/freepass';
import {
  CONTRACT_CLOSE_STATUS,
  NEXT_PLAN_TO_ASSET_STATUS,
} from '@/lib/data/contract-status';
import { deriveBillingsFromReturnExtras } from '@/lib/derive/billings';
import type { RtdbEvent } from '@/lib/types/rtdb-entities';

const KINDS = ['차량이동', '정상출고', '정상반납', '강제회수'];
const HANDOVER = ['탁송', '직접'];
const AGE_OPTIONS = ['21세', '26세', '만30세', '만35세', '전연령'];
const FORCE_REASONS = ['미납', '연락두절', '계약위반', '사고방치', '기타'];
const FUEL_LEVELS = ['F', '3/4', '1/2', '1/4', 'E'];
const EXTERIORS = ['양호', '경미흠집', '손상있음'];
const INTERIORS = ['양호', '보통', '청소필요'];
const CAR_CONDITIONS = ['양호', '경미손상', '수리필요', '사고차', '파손심함'];
const WASH_STATES = ['깨끗', '보통', '세차필요'];
const LEGAL_ACTIONS = ['미진행', '내용증명발송', '소송진행', '완료'];
const NEXT_PLANS = ['재출고', '정비입고', '상품화', '매각'];

const TYPE_MAP: Record<string, string> = {
  정상출고: 'delivery',
  정상반납: 'return',
  강제회수: 'force',
  차량이동: 'transfer',
};

const DELIVERY_CHECKS = [
  { key: 'check_gps', label: 'GPS 확인' },
  { key: 'check_contract', label: '계약서 확인' },
  { key: 'check_insurance_age', label: '보험연령 확인' },
  { key: 'check_payment', label: '잔금/입금 확인' },
  { key: 'check_license', label: '면허증 확인' },
  { key: 'check_insurance', label: '보험가입 확인' },
];

const DELIVERY_EQUIP = [
  { key: 'equip_navi', label: '내비게이션' },
  { key: 'equip_blackbox', label: '블랙박스' },
  { key: 'equip_hipass', label: '하이패스' },
  { key: 'equip_charger', label: '충전케이블' },
  { key: 'equip_triangle', label: '삼각대' },
  { key: 'equip_fire', label: '소화기' },
];

const KEY_FIELDS = [
  { key: 'key_main', label: '메인키' },
  { key: 'key_sub', label: '보조키' },
  { key: 'key_card', label: '카드키' },
  { key: 'key_etc', label: '기타' },
];

function ChkGrid({ cols, flags, toggle, items }: {
  cols: number;
  flags: Record<string, boolean>;
  toggle: (k: string) => void;
  items: { key: string; label: string }[];
}) {
  return (
    <div className="form-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {items.map((it) => (
        <label
          key={it.key}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={!!flags[it.key]}
            onChange={() => toggle(it.key)}
            style={{ width: 14, height: 14 }}
          />
          {it.label}
        </label>
      ))}
    </div>
  );
}

export function IocForm() {
  const [kind, setKind] = useState<string>('정상출고');
  const [handover, setHandover] = useState<string>('탁송');
  const [driverAge, setDriverAge] = useState<string>('만30세');

  // 차량 상태 공통
  const [fuelLevel, setFuelLevel] = useState('F');
  const [exterior, setExterior] = useState('양호');
  const [interior, setInterior] = useState('양호');
  // 반납 전용
  const [carCondition, setCarCondition] = useState('양호');
  const [washStatus, setWashStatus] = useState('보통');
  const [nextPlan, setNextPlan] = useState('재출고');
  // 강제회수 전용
  const [forceReason, setForceReason] = useState(FORCE_REASONS[0]);
  const [legalAction, setLegalAction] = useState('미진행');

  // 체크박스 플래그 (키·출고확인·비품)
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setFlags((s) => ({ ...s, [k]: !s[k] }));

  // 정상출고 — 보험증권 OCR 검증 결과
  const [insCertStatus, setInsCertStatus] = useState<'idle' | 'pass' | 'fail'>('idle');
  const [insCertMsg, setInsCertMsg] = useState<string>('');

  const locations = useLocations();
  const [lastFrom, setLastFrom] = useLastFrom();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');

  useEffect(() => { if (lastFrom) setFrom(lastFrom); }, [lastFrom]);

  const events = useRtdbCollection<RtdbEvent>('events');
  const { carNumber, date } = useOpContext();
  const asset = useAssetByCar(carNumber);
  const activeContract = useContractByCar(carNumber, { activeOnly: true });

  // 보험연령 참조 (정상출고)
  const insAgeRef = useMemo(() => {
    if (!carNumber) return '—';
    const ins = events.data
      .filter((e) => e.car_number === carNumber && e.type === 'insurance' && e.age_after)
      .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
    return ins[0]?.age_after ?? '—';
  }, [events.data, carNumber]);

  return (
    <OpFormBase
      eventType="delivery"
      uploaderLabel={kind === '정상출고' ? '보험증권 업로드' : undefined}
      onOcrExtract={kind === '정상출고' ? (r) => {
        const today = new Date().toISOString().slice(0, 10);
        const cnExtract = (r.car_number ?? '').replace(/\s/g, '');
        const cnCurrent = (carNumber ?? '').replace(/\s/g, '');
        const carOk = !!cnExtract && cnExtract === cnCurrent;
        const dateOk = r.date === today;
        if (carOk && dateOk) {
          setInsCertStatus('pass');
          setInsCertMsg(`검증 통과: ${r.car_number} · ${r.date}`);
          toast.success('보험증권 검증 완료');
        } else {
          setInsCertStatus('fail');
          setInsCertMsg(
            `불일치: 차량번호 ${carOk ? '✓' : `✗ (${r.car_number ?? '없음'})`} · 오늘발급 ${dateOk ? '✓' : `✗ (${r.date ?? '없음'})`}`,
          );
          toast.error('보험증권 불일치');
        }
      } : undefined}
      buildPayload={(d) => {
        if (from) { locations.add(from); setLastFrom(from); }
        if (to) locations.add(to);
        const base: Record<string, unknown> = {
          type: TYPE_MAP[kind] ?? 'delivery',
          title: d.title || `${kind} · ${to || ''}`,
          ioc_kind: kind,
          handover_by: handover,
          from_location: from,
          to_location: to,
          memo: d.memo,
        };

        if (kind === '정상출고' || kind === '정상반납' || kind === '강제회수') {
          base.mileage = Number(String(d.mileage ?? '').replace(/,/g, '')) || undefined;
          base.fuel_level = fuelLevel;
          base.exterior = exterior;
          base.interior = interior;
          // 키 체크박스
          for (const k of KEY_FIELDS) base[k.key] = !!flags[k.key];
        }

        if (kind === '정상출고') {
          base.driver_age = driverAge;
          base.delivery_location = to;
          base.receiver_name = receiverName;
          base.receiver_phone = receiverPhone;
          for (const c of DELIVERY_CHECKS) base[c.key] = !!flags[c.key];
          for (const e of DELIVERY_EQUIP) base[e.key] = !!flags[e.key];
        }

        if (kind === '정상반납') {
          base.car_condition = carCondition;
          base.wash_status = washStatus;
          base.next_plan = nextPlan;
          base.extra_mileage = Number(String(d.extra_mileage ?? '').replace(/,/g, '')) || undefined;
          base.extra_fuel = Number(String(d.extra_fuel ?? '').replace(/,/g, '')) || undefined;
          base.extra_damage = Number(String(d.extra_damage ?? '').replace(/,/g, '')) || undefined;
        }

        if (kind === '강제회수') {
          base.force_reason = forceReason;
          base.car_condition = carCondition;
          base.legal_action = legalAction;
          base.unpaid_amount = Number(String(d.unpaid_amount ?? '').replace(/,/g, '')) || undefined;
          base.damage_claim = Number(String(d.damage_claim ?? '').replace(/,/g, '')) || undefined;
          base.return_location = d.return_location;
          base.handler = d.handler;
        }

        return base;
      }}
      afterSave={async (eventKey, payload) => {
        if (!carNumber) return;

        // freepasserp 상태 자동 동기화
        try {
          if (kind === '정상출고') {
            const ok = await syncVehicleStatus(carNumber, '계약중');
            if (ok) toast.info('freepass 상태 → 계약중');
          } else if (kind === '정상반납') {
            const ok = await syncVehicleStatus(carNumber, '출고가능');
            if (ok) toast.info('freepass 상태 → 출고가능');
          } else if (kind === '강제회수') {
            const ok = await syncVehicleStatus(carNumber, '반납대기');
            if (ok) toast.info('freepass 상태 → 반납대기');
          }
        } catch (err) {
          toast.error(`freepass 상태 동기화 실패: ${(err as Error).message}`);
        }

        // 정상반납/강제회수 — 계약 종료 + 자산 상태 전이
        if (kind === '정상반납' || kind === '강제회수') {
          if (activeContract?._key) {
            const nextStatus = CONTRACT_CLOSE_STATUS[kind];
            try {
              await update(rtdbRef(getRtdb(), `contracts/${activeContract._key}`), {
                contract_status: nextStatus,
                end_date: activeContract.end_date || date,
                updated_at: serverTimestamp(),
              });
              toast.info(`계약 → ${nextStatus}`);
            } catch (err) {
              toast.error(`계약 상태 업데이트 실패: ${(err as Error).message}`);
            }

            // 정상반납 추가청구 → billings 행 생성
            if (kind === '정상반납') {
              try {
                const extraMileage = Number(payload.extra_mileage) || 0;
                const extraFuel = Number(payload.extra_fuel) || 0;
                const extraDamage = Number(payload.extra_damage) || 0;
                const { created } = await deriveBillingsFromReturnExtras({
                  contract: activeContract,
                  returnDate: date,
                  eventKey,
                  charges: [
                    { kind: '과주행', amount: extraMileage },
                    { kind: '연료부족', amount: extraFuel },
                    { kind: '손상수리', amount: extraDamage },
                  ],
                });
                if (created > 0) toast.info(`추가청구 ${created}건 생성`);
              } catch (err) {
                toast.error(`추가청구 생성 실패: ${(err as Error).message}`);
              }
            }
          }

          // 자산 상태 전이 — 정상반납은 next_plan, 강제회수는 상품화대기
          if (asset?._key) {
            const nextAssetStatus =
              kind === '정상반납'
                ? NEXT_PLAN_TO_ASSET_STATUS[nextPlan] ?? '휴차'
                : '상품화대기';
            try {
              await update(rtdbRef(getRtdb(), `assets/${asset._key}`), {
                asset_status: nextAssetStatus,
                updated_at: serverTimestamp(),
              });
              toast.info(`자산 → ${nextAssetStatus}`);
            } catch (err) {
              toast.error(`자산 상태 업데이트 실패: ${(err as Error).message}`);
            }
          }
        }

        // 정상출고 — 자산 가동중 전이
        if (kind === '정상출고') {
          if (asset?._key) {
            try {
              await update(rtdbRef(getRtdb(), `assets/${asset._key}`), {
                asset_status: '가동중',
                updated_at: serverTimestamp(),
              });
            } catch (err) {
              toast.error(`자산 상태 업데이트 실패: ${(err as Error).message}`);
            }
          }
        }

        // 강제회수 + 키 미회수(하나도 체크 안 됨) 시 자산 key_count -1
        if (kind !== '강제회수') return;
        const anyKeyReturned = KEY_FIELDS.some((k) => flags[k.key]);
        if (anyKeyReturned) return;
        if (!asset?._key) return;
        const cur = Number(asset.key_count ?? 2);
        const next = Math.max(0, cur - 1);
        try {
          await update(rtdbRef(getRtdb(), `assets/${asset._key}`), {
            key_count: next,
            updated_at: serverTimestamp(),
          });
          toast.info(`차키 -1 자동 차감 (현재 ${next}개)`);
        } catch (err) {
          toast.error(`차키 자동 차감 실패: ${(err as Error).message}`);
        }
      }}
    >
      <div className="form-section-title">
        <i className="ph ph-arrows-in-line-horizontal" />입출고 · 차량 이동
      </div>
      <div className="form-grid">
        <Field label="업무 구분" required span={3}>
          <BtnGroup value={kind} onChange={setKind} options={KINDS} />
        </Field>
        <Field label="이동 방식" span={3}>
          <BtnGroup value={handover} onChange={setHandover} options={HANDOVER} />
        </Field>

        {kind === '정상출고' && (
          <div style={{ gridColumn: 'span 3' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
              운전자 연령 확인{' '}
              <span className="text-text-muted" style={{ fontSize: 10 }}>
                (보험연령: <b>{insAgeRef}</b>)
              </span>
            </label>
            <BtnGroup value={driverAge} onChange={setDriverAge} options={AGE_OPTIONS} />
          </div>
        )}

        <Field label="출발지">
          <TextInput value={from} onChange={(e) => setFrom(e.target.value)} autoComplete="off" placeholder="예: 용인센터" />
          <FavChips items={locations.list} onPick={setFrom} onDelete={(v) => locations.remove(v)} />
        </Field>
        <Field label={kind === '정상출고' ? '인도장소' : kind === '정상반납' ? '반납장소' : '도착지'} required>
          <TextInput
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
            autoComplete="off"
            placeholder="예: 고객주소·정비소·센터"
          />
          <FavChips items={locations.list} onPick={setTo} onDelete={(v) => locations.remove(v)} />
        </Field>

        {kind === '정상출고' && (
          <>
            <Field label="인수자명">
              <TextInput value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
            </Field>
            <Field label="인수자 연락처">
              <PhoneInput value={receiverPhone} onChange={setReceiverPhone} />
            </Field>
          </>
        )}

        <Field label="메모" span={3}>
          <TextArea name="memo" rows={2} placeholder="탁송기사 연락처·특이사항" />
        </Field>
      </div>

      {/* 차량 상태 — 정상출고·정상반납·강제회수 공통 */}
      {(kind === '정상출고' || kind === '정상반납' || kind === '강제회수') && (
        <div className="form-section">
          <div className="form-section-title"><i className="ph ph-gauge" />차량 상태</div>
          <div className="form-grid">
            <Field label="주행거리 (km)">
              <NumberInput name="mileage" placeholder="0" />
            </Field>
            <Field label="연료잔량" span={2}>
              <BtnGroup value={fuelLevel} onChange={setFuelLevel} options={FUEL_LEVELS} />
            </Field>
            <Field label="외관상태" span={3}>
              <BtnGroup value={exterior} onChange={setExterior} options={EXTERIORS} />
            </Field>
            <Field label="실내상태" span={3}>
              <BtnGroup value={interior} onChange={setInterior} options={INTERIORS} />
            </Field>
            {kind === '정상반납' && (
              <>
                <Field label="차량상태" span={3}>
                  <BtnGroup value={carCondition} onChange={setCarCondition} options={['양호', '경미손상', '수리필요', '사고차']} />
                </Field>
                <Field label="세차상태" span={3}>
                  <BtnGroup value={washStatus} onChange={setWashStatus} options={WASH_STATES} />
                </Field>
              </>
            )}
            {kind === '강제회수' && (
              <Field label="차량상태" span={3}>
                <BtnGroup value={carCondition} onChange={setCarCondition} options={CAR_CONDITIONS} />
              </Field>
            )}
          </div>
        </div>
      )}

      {/* 키 — 정상출고·정상반납·강제회수 공통 */}
      {(kind === '정상출고' || kind === '정상반납' || kind === '강제회수') && (
        <div className="form-section">
          <div className="form-section-title">
            <i className="ph ph-key" />
            {kind === '정상출고' ? '키 인도' : '키 회수'}
          </div>
          <ChkGrid cols={4} flags={flags} toggle={toggle} items={KEY_FIELDS} />
        </div>
      )}

      {/* 정상출고 — 출고 필수 확인 6종 */}
      {kind === '정상출고' && (
        <div className="form-section">
          <div className="form-section-title"><i className="ph ph-check-square" />출고 필수 확인</div>
          <ChkGrid cols={3} flags={flags} toggle={toggle} items={DELIVERY_CHECKS} />
        </div>
      )}

      {/* 정상출고 — 비품 확인 6종 */}
      {kind === '정상출고' && (
        <div className="form-section">
          <div className="form-section-title"><i className="ph ph-clipboard" />비품 확인</div>
          <ChkGrid cols={3} flags={flags} toggle={toggle} items={DELIVERY_EQUIP} />
        </div>
      )}

      {/* 정상출고 — 보험증권 OCR 검증 안내 + 결과 */}
      {kind === '정상출고' && (
        <div className="form-section">
          <div className="form-section-title"><i className="ph ph-shield-check" />보험증권 검증</div>
          <div
            style={{
              padding: 10,
              background: insCertStatus === 'pass' ? 'var(--c-success-bg)'
                : insCertStatus === 'fail' ? 'var(--c-danger-bg)'
                : 'var(--c-bg-sub)',
              border: `1px solid ${
                insCertStatus === 'pass' ? 'var(--c-success)'
                : insCertStatus === 'fail' ? 'var(--c-danger)'
                : 'var(--c-border)'
              }`,
              borderRadius: 2,
              color: insCertStatus === 'pass' ? 'var(--c-success)'
                : insCertStatus === 'fail' ? 'var(--c-danger)'
                : 'var(--c-text-sub)',
              fontSize: 11,
            }}
          >
            {insCertStatus === 'idle'
              ? '아래 첨부파일에 오늘 발급된 보험증권을 업로드 후 OCR 버튼으로 차량번호·발급일 자동 검증'
              : insCertMsg}
          </div>
        </div>
      )}

      {/* 정상반납 — 추가청구 */}
      {kind === '정상반납' && (
        <div className="form-section">
          <div className="form-section-title"><i className="ph ph-receipt" />추가청구</div>
          <div className="form-grid">
            <Field label="과주행 추가금"><NumberInput name="extra_mileage" placeholder="0" /></Field>
            <Field label="연료부족 추가금"><NumberInput name="extra_fuel" placeholder="0" /></Field>
            <Field label="손상수리 추가금"><NumberInput name="extra_damage" placeholder="0" /></Field>
            <Field label="다음예정" span={3}>
              <BtnGroup value={nextPlan} onChange={setNextPlan} options={NEXT_PLANS} />
            </Field>
          </div>
        </div>
      )}

      {/* 강제회수 상세 */}
      {kind === '강제회수' && (
        <>
          <div className="form-section">
            <div className="form-section-title"><i className="ph ph-warning-octagon" />강제회수 정보</div>
            <div className="form-grid">
              <Field label="회수사유" span={3}>
                <BtnGroup value={forceReason} onChange={setForceReason} options={FORCE_REASONS} />
              </Field>
              <Field label="회수장소">
                <TextInput name="return_location" />
              </Field>
              <Field label="회수담당">
                <TextInput name="handler" />
              </Field>
            </div>
          </div>
          <div className="form-section">
            <div className="form-section-title"><i className="ph ph-wallet" />미수 · 정산</div>
            <div className="form-grid">
              <Field label="미납금액">
                <NumberInput name="unpaid_amount" placeholder="0" />
              </Field>
              <Field label="손해배상청구">
                <NumberInput name="damage_claim" placeholder="0" />
              </Field>
              <Field label="법적조치" span={3}>
                <BtnGroup value={legalAction} onChange={setLegalAction} options={LEGAL_ACTIONS} />
              </Field>
            </div>
          </div>
        </>
      )}
    </OpFormBase>
  );
}
