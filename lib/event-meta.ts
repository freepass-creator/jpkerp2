/**
 * 17종 이벤트 타입 공통 메타 (아이콘·색·라벨)
 * 기존 jpkerp EVENT_META/EVENT_LABEL 통합.
 */

export interface EventMeta {
  icon: string; // phosphor class
  color: string;
  label: string;
}

export const EVENT_META: Record<string, EventMeta> = {
  contact: { icon: 'ph-phone', color: '#3b82f6', label: '응대' },
  delivery: { icon: 'ph-truck', color: '#10b981', label: '출고' },
  return: { icon: 'ph-arrow-u-down-left', color: '#059669', label: '반납' },
  force: { icon: 'ph-warning-octagon', color: '#dc2626', label: '강제회수' },
  transfer: { icon: 'ph-arrows-left-right', color: '#14b8a6', label: '이동' },
  key: { icon: 'ph-key', color: '#f59e0b', label: '키' },
  maint: { icon: 'ph-wrench', color: '#f97316', label: '정비' },
  maintenance: { icon: 'ph-wrench', color: '#f97316', label: '정비' },
  accident: { icon: 'ph-car-profile', color: '#ef4444', label: '사고' },
  repair: { icon: 'ph-hammer', color: '#ea580c', label: '수리' },
  penalty: { icon: 'ph-prohibit', color: '#b91c1c', label: '과태료' },
  product: { icon: 'ph-sparkle', color: '#8b5cf6', label: '상품화' },
  insurance: { icon: 'ph-shield-check', color: '#7c3aed', label: '보험' },
  collect: { icon: 'ph-envelope', color: '#2563eb', label: '미수조치' },
  wash: { icon: 'ph-drop', color: '#a855f7', label: '세차' },
  fuel: { icon: 'ph-gas-pump', color: '#c026d3', label: '주유' },
  bank_tx: { icon: 'ph-bank', color: '#059669', label: '통장' },
  card_tx: { icon: 'ph-credit-card', color: '#2563eb', label: '카드' },
};

export function metaFor(type?: string | null): EventMeta {
  return (
    EVENT_META[type ?? ''] ?? { icon: 'ph-circle', color: '#9b9a97', label: type ?? '-' }
  );
}
