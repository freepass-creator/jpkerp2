/**
 * OP_ICONS — 정제된 ERP 톤. 모든 유형 아이콘은 중립 회색 고정.
 * 색은 "상태"에만 쓰고, 유형 구분은 아이콘 shape으로.
 */
import type { OpKey } from './op-types';

interface OpIcon {
  name: string;
  color: string;
}

const NEUTRAL = 'var(--c-text-sub)';

export const OP_ICONS: Record<string, OpIcon> = {
  ioc:              { name: 'ph-arrows-in-line-horizontal', color: NEUTRAL },
  pc:               { name: 'ph-sparkle',                    color: NEUTRAL },
  contact:          { name: 'ph-phone',                      color: NEUTRAL },
  collect:          { name: 'ph-envelope',                   color: NEUTRAL },
  delivery:         { name: 'ph-truck',                      color: NEUTRAL },
  return:           { name: 'ph-arrow-u-down-left',          color: NEUTRAL },
  transfer:         { name: 'ph-arrows-left-right',          color: NEUTRAL },
  force:            { name: 'ph-warning-octagon',            color: NEUTRAL },
  accident:         { name: 'ph-car-profile',                color: NEUTRAL },
  ignition:         { name: 'ph-engine',                     color: NEUTRAL },
  penalty:          { name: 'ph-prohibit',                   color: NEUTRAL },
  penalty_notice:   { name: 'ph-receipt',                    color: NEUTRAL },
  product_register: { name: 'ph-storefront',                 color: NEUTRAL },
  disposal:         { name: 'ph-archive-box',                color: NEUTRAL },
  maint:            { name: 'ph-wrench',                     color: NEUTRAL },
  repair:           { name: 'ph-hammer',                     color: NEUTRAL },
  key:              { name: 'ph-key',                        color: NEUTRAL },
  product:          { name: 'ph-sparkle',                    color: NEUTRAL },
  insurance:        { name: 'ph-shield-check',               color: NEUTRAL },
  wash:             { name: 'ph-drop',                       color: NEUTRAL },
  fuel:             { name: 'ph-gas-pump',                   color: NEUTRAL },
};

export function opIconOf(key: OpKey | string) {
  return OP_ICONS[key] ?? { name: 'ph-circle', color: NEUTRAL };
}
