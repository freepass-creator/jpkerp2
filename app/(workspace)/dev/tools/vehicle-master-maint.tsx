'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ref, update, serverTimestamp } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import { useRtdbCollection } from '@/lib/collections/rtdb';
import type { RtdbCarModel } from '@/lib/types/rtdb-entities';

const COLLECTION = 'vehicle_master';

/** 화물차 supplement 엔트리 — scripts/vehicle-master-cargo-supplement.json 과 동일. */
const CARGO_SUPPLEMENT: Array<{ _key: string } & Record<string, unknown>> = [
  {
    _key: 'supplement_002_bongo3_cargo',
    origin: '국산', maker: '기아', model: '봉고III',
    sub: '봉고III 1톤 카고', car_name: '봉고III 1톤 카고',
    source: 'supplement', status: 'active', category: '화물차',
    production_start: '2004-01', production_end: '현재', archived: false,
    maker_eng: 'Kia', maker_code: '002',
  },
  {
    _key: 'supplement_002_bongo3_cargo_dump',
    origin: '국산', maker: '기아', model: '봉고III',
    sub: '봉고III 덤프', car_name: '봉고III 덤프',
    source: 'supplement', status: 'active', category: '화물차',
    production_start: '2004-01', production_end: '현재', archived: false,
    maker_eng: 'Kia', maker_code: '002',
  },
  {
    _key: 'supplement_005_porter2_cargo',
    origin: '국산', maker: '현대', model: '포터II',
    sub: '포터II 1톤 카고', car_name: '포터II 1톤 카고',
    source: 'supplement', status: 'active', category: '화물차',
    production_start: '2004-01', production_end: '현재', archived: false,
    maker_eng: 'Hyundai', maker_code: '005',
  },
  {
    _key: 'supplement_005_porter2_naejang',
    origin: '국산', maker: '현대', model: '포터II',
    sub: '포터II 내장탑차', car_name: '포터II 내장탑차',
    source: 'supplement', status: 'active', category: '화물차',
    production_start: '2004-01', production_end: '현재', archived: false,
    maker_eng: 'Hyundai', maker_code: '005',
  },
];

function cutoffMonth(years: number) {
  const now = new Date();
  const y = now.getFullYear() - years;
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function extractEndMonth(entry: RtdbCarModel): string | null {
  const pe = entry.production_end;
  if (pe === '현재') return null;
  if (typeof pe === 'string') {
    const m = pe.match(/^(\d{4})(?:[-/.](\d{1,2}))?/);
    if (m) return `${m[1]}-${(m[2] ?? '12').padStart(2, '0')}`;
  }
  const ye = entry.year_end;
  if (ye === '현재' || ye == null || ye === '') return null;
  const yn = Number(String(ye).replace(/,/g, ''));
  if (Number.isFinite(yn) && yn > 1900) return `${yn}-12`;
  return null;
}

export function VehicleMasterMaintTool() {
  const masters = useRtdbCollection<RtdbCarModel>(COLLECTION);
  const [busy, setBusy] = useState(false);
  const [archiveYears, setArchiveYears] = useState(15);

  const stats = useMemo(() => {
    const all = masters.data;
    const active = all.filter((m) => m.status !== 'deleted');
    const supplement = active.filter((m) => (m as { source?: string }).source === 'supplement');
    const archived = all.filter((m) => (m as { archived?: boolean }).archived === true || m.status === 'deleted');
    return {
      total: all.length,
      active: active.length,
      supplement: supplement.length,
      archived: archived.length,
    };
  }, [masters.data]);

  const cargoStatus = useMemo(() => {
    const existing = new Set(masters.data.map((m) => (m as { _key?: string })._key));
    const installed = CARGO_SUPPLEMENT.filter((s) => existing.has(s._key));
    return { installed: installed.length, total: CARGO_SUPPLEMENT.length };
  }, [masters.data]);

  const archivePreview = useMemo(() => {
    const cutoff = cutoffMonth(archiveYears);
    let count = 0;
    const samples: Array<{ key: string; label: string; endMonth: string }> = [];
    for (const m of masters.data) {
      if (m.status === 'deleted') continue;
      if ((m as { archived?: boolean }).archived) continue;
      const end = extractEndMonth(m);
      if (end && end < cutoff) {
        count++;
        if (samples.length < 10) {
          samples.push({
            key: (m as { _key?: string })._key ?? '',
            label: `${m.maker ?? '?'} / ${m.model ?? '?'} / ${m.sub ?? '?'}`,
            endMonth: end,
          });
        }
      }
    }
    return { cutoff, count, samples };
  }, [masters.data, archiveYears]);

  const installCargo = async () => {
    if (!confirm(`화물차 supplement ${CARGO_SUPPLEMENT.length}건을 RTDB에 추가/업데이트하시겠습니까?\n(기존 엔카 데이터는 건드리지 않음)`)) return;
    setBusy(true);
    try {
      const updates: Record<string, unknown> = {};
      for (const row of CARGO_SUPPLEMENT) {
        const { _key, ...payload } = row;
        updates[_key] = { ...payload, created_at: serverTimestamp(), updated_at: serverTimestamp() };
      }
      await update(ref(getRtdb(), COLLECTION), updates);
      toast.success(`화물차 ${CARGO_SUPPLEMENT.length}건 추가 완료`);
    } catch (e) {
      toast.error(`실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const archiveOld = async () => {
    if (archivePreview.count === 0) { toast.info('아카이브할 엔트리 없음'); return; }
    if (!confirm(`${archiveYears}년 이상 단종된 ${archivePreview.count}건을 아카이브(soft delete)하시겠습니까?\n기준: production_end < ${archivePreview.cutoff}\n복구는 carmaster 도구에서 가능합니다.`)) return;
    setBusy(true);
    try {
      const updates: Record<string, unknown> = {};
      const now = Date.now();
      const cutoff = archivePreview.cutoff;
      for (const m of masters.data) {
        if (m.status === 'deleted') continue;
        if ((m as { archived?: boolean }).archived) continue;
        const end = extractEndMonth(m);
        if (!end || end >= cutoff) continue;
        const key = (m as { _key?: string })._key;
        if (!key) continue;
        updates[`${key}/status`] = 'deleted';
        updates[`${key}/archived`] = true;
        updates[`${key}/archived_reason`] = `${archiveYears}년 이상 단종 (cutoff=${cutoff})`;
        updates[`${key}/archived_at`] = now;
      }
      await update(ref(getRtdb(), COLLECTION), updates);
      toast.success(`${archivePreview.count}건 아카이브 완료`);
    } catch (e) {
      toast.error(`실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 overflow-y-auto scrollbar-thin" style={{ height: '100%' }}>
      {/* 현황 */}
      <section className="form-section pt-0">
        <div className="form-section-title">
          <i className="ph ph-gauge" />차종마스터 현황
        </div>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <StatBox label="전체" value={stats.total} />
          <StatBox label="활성" value={stats.active} tone="success" />
          <StatBox label="아카이브" value={stats.archived} tone="neutral" />
          <StatBox label="supplement" value={stats.supplement} tone="primary" />
        </div>
      </section>

      {/* 화물차 supplement */}
      <section className="form-section">
        <div className="form-section-title">
          <i className="ph ph-truck" />화물차 supplement
          <span className="text-text-muted text-2xs ml-auto">
            설치됨: {cargoStatus.installed}/{cargoStatus.total}
          </span>
        </div>
        <div className="text-xs text-text-sub mb-2" style={{ lineHeight: 1.6 }}>
          엔카 크롤러는 승용차만 수집 — 화물차(봉고III, 포터II 등)는 별도 보완 필요.
          아래 4건이 없으면 "봉고3" / "포터 II" CSV 업로드 시 매칭 실패로 스킵됩니다.
        </div>
        <ul className="text-xs text-text-sub" style={{ paddingLeft: 18, margin: '0 0 10px 0' }}>
          {CARGO_SUPPLEMENT.map((s) => (
            <li key={s._key}>
              {String(s.maker)} {String(s.model)} / {String(s.sub)}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={installCargo}
          disabled={busy}
        >
          <i className="ph ph-download-simple" />
          화물차 4건 추가/갱신
        </button>
      </section>

      {/* 15년 이상 아카이브 */}
      <section className="form-section">
        <div className="form-section-title">
          <i className="ph ph-archive-box" />단종 아카이브 (soft delete)
        </div>
        <div className="text-xs text-text-sub mb-2" style={{ lineHeight: 1.6 }}>
          기준: production_end 가 cutoff 이전이면 아카이브. "현재" 생산 중 모델은 보존.
          복구는 carmaster 도구의 filter=archived 에서 status='active' 로 되돌릴 수 있음.
        </div>
        <div className="flex items-center gap-2 mb-2 text-xs">
          <label>년 이상:</label>
          <input
            type="number"
            min={5}
            max={40}
            value={archiveYears}
            onChange={(e) => setArchiveYears(Math.max(5, Number(e.target.value) || 15))}
            style={{ width: 60, padding: '2px 6px', border: '1px solid var(--c-border)', borderRadius: 2 }}
          />
          <span className="text-text-muted">cutoff = {archivePreview.cutoff}</span>
          <span className="text-text-sub font-semibold" style={{ marginLeft: 'auto' }}>
            대상 {archivePreview.count}건
          </span>
        </div>
        {archivePreview.samples.length > 0 && (
          <details className="text-xs text-text-muted mb-2">
            <summary style={{ cursor: 'pointer' }}>샘플 10개 보기</summary>
            <ul style={{ paddingLeft: 18, margin: '4px 0 0 0' }}>
              {archivePreview.samples.map((s) => (
                <li key={s.key}>{s.endMonth} — {s.label}</li>
              ))}
            </ul>
          </details>
        )}
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={archiveOld}
          disabled={busy || archivePreview.count === 0}
        >
          <i className="ph ph-archive-box" />
          {archivePreview.count}건 아카이브
        </button>
      </section>
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'primary' | 'neutral' }) {
  const color = tone === 'success' ? 'text-success' : tone === 'primary' ? 'text-primary' : tone === 'neutral' ? 'text-text-sub' : 'text-text';
  return (
    <div className="flex flex-col items-center gap-0.5 p-2" style={{ border: '1px solid var(--c-border)', borderRadius: 2 }}>
      <div className={`text-lg font-bold num ${color}`}>{value}</div>
      <div className="text-2xs text-text-muted">{label}</div>
    </div>
  );
}
