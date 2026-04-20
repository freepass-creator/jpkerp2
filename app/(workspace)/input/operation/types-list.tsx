'use client';

import { SortableTypesList, type TypeItem } from '@/components/shared/sortable-types-list';
import type { OpKey } from './op-types';

// jpkerp 최신 버전 visible DEFAULT_TYPES (hidden 제외)
const DEFAULT_TYPES: TypeItem<OpKey>[] = [
  { key: 'ioc',              label: '입출고센터',     icon: 'ph-arrows-in-line-horizontal' },
  { key: 'pc',               label: '차량케어센터',   icon: 'ph-sparkle' },
  { key: 'contact',          label: '고객센터',       icon: 'ph-phone' },
  { key: 'accident',         label: '사고접수',       icon: 'ph-car-profile' },
  { key: 'ignition',         label: '시동제어',       icon: 'ph-engine' },
  { key: 'insurance',        label: '보험관리',       icon: 'ph-shield-check' },
  { key: 'product_register', label: '상품등록',       icon: 'ph-storefront' },
  { key: 'penalty_notice',   label: '과태료작업',     icon: 'ph-receipt' },
  { key: 'disposal',         label: '자산처분',       icon: 'ph-archive-box' },
];

export function TypesList({ selected, onSelect }: { selected: OpKey; onSelect: (k: OpKey) => void }) {
  return (
    <SortableTypesList<OpKey>
      items={DEFAULT_TYPES}
      selected={selected}
      onSelect={onSelect}
      storageKey="jpk.op.order"
    />
  );
}
