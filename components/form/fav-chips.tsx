'use client';

/**
 * 즐겨찾기 pill 목록 — jpkerp `.loc-favs`·`.loc-fav-btn` 이식.
 * 입력칸 아래 가로 pill로 나열. 클릭 = 선택, ✕ = 삭제.
 */
interface Props {
  items: string[];
  onPick: (v: string) => void;
  onDelete?: (v: string) => void;
}

export function FavChips({ items, onPick, onDelete }: Props) {
  if (!items.length) return null;
  return (
    <div className="loc-favs">
      {items.map((v) => (
        <span
          key={v}
          className="loc-fav-btn"
          onClick={(e) => {
            if ((e.target as HTMLElement).classList.contains('loc-fav-del')) return;
            onPick(v);
          }}
        >
          {v}
          {onDelete && (
            <button
              type="button"
              className="loc-fav-del"
              aria-label="삭제"
              onClick={(e) => { e.stopPropagation(); onDelete(v); }}
            >
              ✕
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
