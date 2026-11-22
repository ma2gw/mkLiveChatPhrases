import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { contrastRatio, isHexColor, textColorFor } from '../lib/color';
import { loadSettings } from '../lib/storage/settings';

describe('文字の色を背景から選ぶ', () => {
  it.each([
    ['#ffffff', '#000000'],
    ['#000000', '#ffffff'],
    ['#ffeb3b', '#000000'], // 明るい黄色には黒
    ['#0b5d2a', '#ffffff'], // 濃い緑には白
    ['#1e8e3e', '#000000'], // 中くらいの緑は、コントラスト比では黒のほうが少し高い（白 4.21 / 黒 4.99）
    ['#3ea6ff', '#000000'], // 明るい青には黒
    ['#7f7f7f', '#000000'], // 真ん中くらいの灰色は、比べて読みやすいほう
  ])('%s → %s', (bg, fg) => {
    expect(textColorFor(bg)).toBe(fg);
  });
  it('選んだほうが、もう片方よりコントラストが高い', () => {
    for (const bg of ['#123456', '#abcdef', '#ff0000', '#00ff00']) {
      const fg = textColorFor(bg);
      const other = fg === '#000000' ? '#ffffff' : '#000000';
      expect(contrastRatio(bg, fg)).toBeGreaterThanOrEqual(contrastRatio(bg, other));
    }
  });
  it('#rrggbb でなければ黒', () => {
    expect(isHexColor('red')).toBe(false);
    expect(textColorFor('red')).toBe('#000000');
  });
});

describe('見た目の設定を読む', () => {
  beforeEach(() => fakeBrowser.reset());

  it('何も保存されていなければ、色は自動で不透明度は 100%', async () => {
    expect((await loadSettings()).appearance).toEqual({ opacity: 100 });
  });

  it('色は #rrggbb だけを受け付け（小文字にそろえる）、不透明度は 0〜100 に収める', async () => {
    await fakeBrowser.storage.sync.set({
      settings: { appearance: { menuColor: '#ABCDEF', borderColor: 'red', iconColor: '#123456', opacity: -10 } },
    });
    expect((await loadSettings()).appearance).toEqual({ menuColor: '#abcdef', iconColor: '#123456', opacity: 0 });
    await fakeBrowser.storage.sync.set({ settings: { appearance: { opacity: 87 } } });
    expect((await loadSettings()).appearance).toEqual({ opacity: 87 });
  });
});
