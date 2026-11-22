/**
 * 使う mod の一覧と、mod をかける処理
 *
 * mod を足すときは、lib/mods/ にファイルを作り、MODS に足す（文言は _locales に足す）
 * MODS の順番が、ボタンの並びと、mod をかける順番になる
 */
import { dotsMod } from './dots';
import { repeat2Mod, repeat3Mod } from './repeat';
import { reverseMod } from './reverse';
import type { Mod } from './types';

export type { Mod } from './types';

export const MODS: readonly Mod[] = [
  reverseMod,
  repeat2Mod,
  repeat3Mod,
  // ドットの数は引数で変えられる（例: dotsMod(3) で '...'）
  dotsMod(1),
];

/** 設定で有効にした mod（設定の enabledMods に入っているもの）を、MODS の順で返す */
export function enabledMods(enabled: readonly string[], mods: readonly Mod[] = MODS): Mod[] {
  return mods.filter((m) => enabled.includes(m.id));
}

/** オンになっている mod を、MODS の順にかける */
export function applyMods(text: string, active: ReadonlySet<string>, mods: readonly Mod[] = MODS): string {
  return mods.reduce((s, mod) => (active.has(mod.id) ? mod.apply(s) : s), text);
}

/** コピーできたあとに呼ぶ。once の mod をオフにした、新しい集合を返す */
export function afterCopy(active: ReadonlySet<string>, mods: readonly Mod[] = MODS): Set<string> {
  const next = new Set(active);
  for (const m of mods) if (m.once) next.delete(m.id);
  return next;
}

/**
 * mod のオンとオフを切り替えた、新しい集合を返す
 * オンにするときは、同じ group のほかの mod をオフにする
 */
export function toggleMod(active: ReadonlySet<string>, id: string, mods: readonly Mod[] = MODS): Set<string> {
  const next = new Set(active);
  if (next.has(id)) {
    next.delete(id);
    return next;
  }
  const group = mods.find((m) => m.id === id)?.group;
  if (group) {
    for (const m of mods) if (m.group === group) next.delete(m.id);
  }
  next.add(id);
  return next;
}
