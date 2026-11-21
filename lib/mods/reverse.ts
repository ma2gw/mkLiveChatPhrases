import type { Mod } from './types';

/** :_xxx: や :xxx: の形の絵文字（YouTube のチャットで絵文字に変わる） */
const SHORTCODE = /:[^:\s]+:/g;

/**
 * 文字列を逆の順番にする
 * 見た目の 1 文字（絵文字の組み合わせなど）と :_xxx: の形の絵文字は、まとまりのまま入れ替える
 */
export function reverseText(text: string): string {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const units: string[] = [];
  const pushGraphemes = (s: string) => {
    for (const { segment } of segmenter.segment(s)) units.push(segment);
  };
  let last = 0;
  for (const m of text.matchAll(SHORTCODE)) {
    pushGraphemes(text.slice(last, m.index));
    units.push(m[0]);
    last = m.index + m[0].length;
  }
  pushGraphemes(text.slice(last));
  return units.reverse().join('');
}

/** ⇄: 逆の順番にする。1 回コピーしたらオフに戻る */
export const reverseMod: Mod = {
  id: 'reverse',
  label: '⇄',
  messageKey: 'reverse',
  once: true,
  apply: reverseText,
};
