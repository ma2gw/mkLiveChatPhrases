/**
 * ドラッグでの並べ替え（ブラウザの Drag and Drop だけで作る。ライブラリは使わない）
 *
 * - ドラッグを始めるのは「≡」のつまみだけ（行の中の入力欄は普通に使えるように）
 * - 落とす位置は「その行の上半分なら前、下半分なら後ろ」
 * - 位置は「動かす前の並びでの挿入位置」で表す（lib/model/edit.ts の moveInArray と同じ）
 */

export type DragKind = 'phrase' | 'channel' | 'group';

export interface DragItem {
  kind: DragKind;
  /** どの並びの中か（フレーズならチャンネルの id など） */
  list: string;
  index: number;
  id: string;
}

/** ドラッグ中のもの */
let current: DragItem | null = null;

/** 落とす位置の目印（行の前に線を出す） */
export const dropHint = $state({ kind: null as DragKind | null, list: '', index: -1 });

export function startDrag(e: DragEvent, item: DragItem): void {
  current = item;
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', item.id);
  // つまみだけでなく、行全体がドラッグされているように見せる
  const row = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-drag-row]');
  if (row) e.dataTransfer.setDragImage(row, 16, row.offsetHeight / 2);
}

export function endDrag(): void {
  current = null;
  dropHint.kind = null;
}

/** ドラッグ中のものが kind なら返す */
export function dragging(kind: DragKind): DragItem | null {
  return current?.kind === kind ? current : null;
}

/** 行の上で動かしているとき。落とす位置（index か index + 1）を返す */
export function overRow(e: DragEvent, kind: DragKind, list: string, index: number): number | null {
  if (!dragging(kind)) return null;
  e.preventDefault();
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const at = e.clientY > r.top + r.height / 2 ? index + 1 : index;
  Object.assign(dropHint, { kind, list, index: at });
  return at;
}

/** 並びの最後に落とす場所（グループの見出しなど）の上で動かしているとき */
export function overEnd(e: DragEvent, kind: DragKind, list: string, length: number): number | null {
  if (!dragging(kind)) return null;
  e.preventDefault();
  Object.assign(dropHint, { kind, list, index: length });
  return length;
}

/** 目印をこの位置に出すか */
export function hintAt(kind: DragKind, list: string, index: number): boolean {
  return dropHint.kind === kind && dropHint.list === list && dropHint.index === index;
}
