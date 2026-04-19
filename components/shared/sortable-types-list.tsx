'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface TypeItem<K extends string = string> {
  key: K;
  label: string;
  icon: string;
}

interface Props<K extends string> {
  items: TypeItem<K>[];
  selected: K;
  onSelect: (k: K) => void;
  /** localStorage 키 (순서 저장). 생략 시 저장 안 함. */
  storageKey?: string;
}

function loadOrder<K extends string>(storageKey: string | undefined, defaults: K[]): K[] {
  if (!storageKey) return defaults;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as K[];
    const seen = new Set(saved);
    const missing = defaults.filter((k) => !seen.has(k));
    return [...saved.filter((k) => defaults.includes(k)), ...missing];
  } catch {
    return defaults;
  }
}

function saveOrder(storageKey: string | undefined, keys: string[]) {
  if (!storageKey) return;
  try { localStorage.setItem(storageKey, JSON.stringify(keys)); } catch { /* noop */ }
}

function SortableItem<K extends string>({
  item,
  active,
  onSelect,
}: {
  item: TypeItem<K>;
  active: boolean;
  onSelect: (k: K) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const cls = ['op-type', active ? 'is-active' : ''].filter(Boolean).join(' ');

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-type={item.key}
      className={cls}
      onClick={() => onSelect(item.key)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(item.key)}
      role="button"
      tabIndex={0}
    >
      <span className="op-type__icon"><i className={`ph ${item.icon}`} /></span>
      <span className="op-type__label">{item.label}</span>
      <span
        className="op-type__handle"
        style={{ marginLeft: 'auto', cursor: 'grab', touchAction: 'none' }}
        title="드래그로 순서 변경"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        ⠿
      </span>
    </div>
  );
}

export function SortableTypesList<K extends string>({ items, selected, onSelect, storageKey }: Props<K>) {
  const defaults = useMemo(() => items.map((t) => t.key), [items]);
  const [order, setOrder] = useState<K[]>(defaults);

  useEffect(() => {
    setOrder(loadOrder(storageKey, defaults));
  }, [storageKey, defaults]);

  const byKey = useMemo(() => new Map(items.map((t) => [t.key, t])), [items]);
  const ordered = useMemo(() => order.map((k) => byKey.get(k)).filter((x): x is TypeItem<K> => !!x), [order, byKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(active.id as K);
    const to = order.indexOf(over.id as K);
    if (from === -1 || to === -1) return;
    const next = arrayMove(order, from, to);
    setOrder(next);
    saveOrder(storageKey, next);
  }

  return (
    <div className="overflow-y-auto scrollbar-thin" style={{ height: '100%' }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ordered.map((t) => t.key)} strategy={verticalListSortingStrategy}>
          {ordered.map((t) => (
            <SortableItem<K>
              key={t.key}
              item={t}
              active={t.key === selected}
              onSelect={onSelect}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
