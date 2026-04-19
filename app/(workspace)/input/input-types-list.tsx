'use client';

import { SortableTypesList, type TypeItem } from '@/components/shared/sortable-types-list';
import { INPUT_LABELS, INPUT_ICONS, type InputKey } from './input-types';

const DEFAULT_TYPES: TypeItem<InputKey>[] = (Object.keys(INPUT_LABELS) as InputKey[]).map((k) => ({
  key: k,
  label: INPUT_LABELS[k],
  icon: INPUT_ICONS[k],
}));

export function InputTypesList({ selected, onSelect }: { selected: InputKey; onSelect: (k: InputKey) => void }) {
  return (
    <SortableTypesList<InputKey>
      items={DEFAULT_TYPES}
      selected={selected}
      onSelect={onSelect}
      storageKey="jpk.input.order"
    />
  );
}
