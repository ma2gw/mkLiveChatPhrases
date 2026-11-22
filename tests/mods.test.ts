import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createEmptyData } from '../lib/model/types';
import { afterCopy, applyMods, enabledMods, MODS, toggleMod, type Mod } from '../lib/mods';
import { loadSettings, saveSettings } from '../lib/storage/settings';
import { saveData } from '../lib/storage/sync';
import { dotsMod } from '../lib/mods/dots';
import { repeat2Mod, repeat3Mod } from '../lib/mods/repeat';
import { reverseMod, reverseText } from '../lib/mods/reverse';

const on = (...mods: Mod[]) => new Set(mods.map((m) => m.id));
const dotMod = dotsMod(1);

describe('mod の一覧', () => {
  it('id が重ならない', () => {
    const ids = MODS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('有効にした mod だけを、MODS の順のまま返す', () => {
    expect(enabledMods([dotMod.id, reverseMod.id], [reverseMod, repeat2Mod, dotMod])).toEqual([reverseMod, dotMod]);
    expect(enabledMods(['unknown'], [reverseMod])).toEqual([]); // 知らない id は無視
    expect(enabledMods([], [reverseMod])).toEqual([]); // 何も有効にしていなければ空
  });
});

describe('設定の保存と読み込み', () => {
  beforeEach(() => fakeBrowser.reset());

  it('何も保存されていなければ、どの mod も無効で、Enter では追加しない', async () => {
    expect(await loadSettings()).toEqual({ enabledMods: [], submitOnEnter: false, hideUnregistered: false, appearance: { opacity: 100 } });
  });

  it('保存したものを読める。形が違えば初期値にする', async () => {
    await saveSettings({ enabledMods: ['reverse'], submitOnEnter: true, hideUnregistered: true, appearance: { opacity: 100 } });
    expect(await loadSettings()).toEqual({ enabledMods: ['reverse'], submitOnEnter: true, hideUnregistered: true, appearance: { opacity: 100 } });
    await fakeBrowser.storage.sync.set({ settings: { enabledMods: 'broken', submitOnEnter: 'yes' } });
    expect(await loadSettings()).toEqual({ enabledMods: [], submitOnEnter: false, hideUnregistered: false, appearance: { opacity: 100 } });
  });

  it('フレーズのデータを保存しても、設定は消えない', async () => {
    await saveSettings({ enabledMods: ['reverse'], submitOnEnter: true, hideUnregistered: true, appearance: { opacity: 100 } });
    const r = await saveData(createEmptyData());
    expect(r.ok).toBe(true);
    expect(await loadSettings()).toEqual({ enabledMods: ['reverse'], submitOnEnter: true, hideUnregistered: true, appearance: { opacity: 100 } });
  });
});

describe('mod をかける', () => {
  it('どれもオフならそのまま', () => {
    expect(applyMods('abc', new Set())).toBe('abc');
  });
  it('. は末尾にドットを 1 つ付ける', () => {
    expect(applyMods('abc', on(dotMod))).toBe('abc.');
    expect(applyMods('abc.', on(dotMod))).toBe('abc..');
  });
  it('ドットの数は変えられる', () => {
    const three = dotsMod(3);
    expect(three.label).toBe('...');
    expect(applyMods('abc', on(three), [three])).toBe('abc...');
    expect(dotsMod(0).apply('a')).toBe('a.'); // 1 より少なければ 1 つ
  });
  it('×2 / ×3 はつなげる', () => {
    expect(applyMods('ab', on(repeat2Mod))).toBe('abab');
    expect(applyMods('ab', on(repeat3Mod))).toBe('ababab');
  });
  it('MODS の順にかける（逆にする → つなげる → ドット）', () => {
    expect(applyMods('ab', on(dotMod, repeat3Mod, reverseMod))).toBe('bababa.');
  });
});

describe('mod のオンとオフ', () => {
  it('押すたびに切り替わる', () => {
    const a = toggleMod(new Set(), dotMod.id);
    expect([...a]).toEqual([dotMod.id]);
    expect([...toggleMod(a, dotMod.id)]).toEqual([]);
  });
  it('同じ group の mod は、どれか 1 つだけオンになる', () => {
    const a = toggleMod(on(repeat2Mod, dotMod), repeat3Mod.id);
    expect([...a].sort()).toEqual([dotMod.id, repeat3Mod.id].sort());
  });
  it('コピーしたら、once の mod だけオフに戻る', () => {
    const after = afterCopy(on(reverseMod, repeat2Mod, dotMod));
    expect(reverseMod.once).toBe(true);
    expect([...after].sort()).toEqual([dotMod.id, repeat2Mod.id].sort());
  });
  it('元の集合は書き換えない', () => {
    const before = on(dotMod);
    toggleMod(before, reverseMod.id);
    expect([...before]).toEqual([dotMod.id]);
  });
});

describe('⇄ 逆の順番にする', () => {
  it('1 文字ずつ逆にする', () => {
    expect(reverseText('あいう')).toBe('ういあ');
  });
  it('組み合わせの絵文字は壊さない', () => {
    // 🐻‍❄️ は複数の文字の組み合わせ、👍🏽 は肌の色付き
    expect(reverseText('a🐻‍❄️b👍🏽')).toBe('👍🏽b🐻‍❄️a');
  });
  it(':_xxx: の形の絵文字はまとまりのまま入れ替える', () => {
    expect(reverseText(':_foo:x:_bar::_baz:')).toBe(':_baz::_bar:x:_foo:');
  });
});
