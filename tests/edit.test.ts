import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../lib/model/compare';
import {
  addChannel,
  addGroup,
  addPhraseToChannel,
  deleteChannel,
  deleteGroup,
  moveChannel,
  moveInArray,
  normalizeForSave,
  placeOf,
} from '../lib/model/edit';
import { createEmptyData, newId, type Channel } from '../lib/model/types';
import { checkRules } from '../lib/model/validate';

describe('配列の中で動かす', () => {
  // to は「動かす前の配列」での挿入位置
  it.each([
    [0, 2, ['b', 'a', 'c']], // a を c の前へ
    [0, 3, ['b', 'c', 'a']], // a を最後へ
    [2, 0, ['c', 'a', 'b']], // c を最初へ
    [1, 1, ['a', 'b', 'c']], // 同じ位置
    [1, 2, ['a', 'b', 'c']], // 自分のすぐ後ろ = 動かない
  ])('%i → %i', (from, to, expected) => {
    const list = ['a', 'b', 'c'];
    moveInArray(list, from, to);
    expect(list).toEqual(expected);
  });
});

describe('チャンネルとグループの編集（直接書き換える）', () => {
  it('チャンネルを追加して、グループの間で動かし、消す', () => {
    const data = createEmptyData();
    const g = addGroup(data, 'G');
    const a = addChannel(data, null);
    a.accounts.youtube = { handle: 'a' };
    const b = addChannel(data, g.id);
    b.accounts.youtube = { handle: 'b' };
    expect(placeOf(data, a.id)).toBeNull();
    expect(placeOf(data, b.id)).toBe(g.id);

    moveChannel(data, a.id, g.id, 0); // a を G の先頭へ
    expect(g.channelIds).toEqual([a.id, b.id]);
    expect(data.ungroupedChannelIds).toEqual([]);

    moveChannel(data, a.id, g.id, 2); // 同じグループの中で最後へ
    expect(g.channelIds).toEqual([b.id, a.id]);
    expect(checkRules(data)).toEqual([]);

    deleteChannel(data, a.id);
    expect(g.channelIds).toEqual([b.id]);
    expect(data.channels[a.id]).toBeUndefined();
  });

  it('グループを消すと、中のチャンネルは「グループなし」の最後に移る', () => {
    const data = createEmptyData();
    const x = addChannel(data, null);
    const g = addGroup(data, 'G');
    const y = addChannel(data, g.id);
    deleteGroup(data, g.id);
    expect(data.groups).toEqual([]);
    expect(data.ungroupedChannelIds).toEqual([x.id, y.id]);
  });
});

describe('保存する前に形をそろえる', () => {
  it('空の値を省き、ハンドルを正規化する。コピーする文字列はそのまま', () => {
    const data = createEmptyData();
    const ch = addChannel(data, null);
    Object.assign(ch, { name: '  ', accounts: { youtube: { handle: ' @Foo ', siteChannelId: '' } } });
    ch.phrases.push({ id: 'p1', text: ' a ', label: '' }, { id: 'p2', text: 'b', label: 'b' }, { id: 'p3', text: 'c', label: 'C' });
    normalizeForSave(data);
    expect(ch).toEqual({
      id: ch.id,
      accounts: { youtube: { handle: 'Foo' } },
      phrases: [
        { id: 'p1', text: ' a ' },
        { id: 'p2', text: 'b' },
        { id: 'p3', text: 'c', label: 'C' },
      ],
    });
  });

  it('コピーする文字列が空のフレーズはエラーにする', () => {
    const data = createEmptyData();
    data.globalPhrases.push({ id: 'p1', text: '  ' });
    expect(checkRules(data)).toEqual([{ code: 'emptyPhrase', detail: 'p1' }]);
  });
});

describe('比べるための JSON', () => {
  it('キーの順番が違っても同じになる', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(canonicalJson({ a: [{ c: 3, d: 2 }], b: 1 }));
  });
  it('undefined の項目は無いものとして扱う', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });
});

function dataWith(channel: Channel) {
  const data = createEmptyData();
  data.channels[channel.id] = channel;
  data.ungroupedChannelIds.push(channel.id);
  return data;
}

describe('+ でフレーズを追加する', () => {
  it('登録済みのチャンネルの最後に、ラベルなしで追加する', () => {
    const ch: Channel = { id: newId(), accounts: { youtube: { handle: 'foo' } }, phrases: [{ id: newId(), text: 'a' }] };
    const data = dataWith(ch);
    const next = addPhraseToChannel(data, { site: 'youtube', handle: 'FOO' }, 'b')!;
    expect(next.channels[ch.id]!.phrases.map((p) => [p.text, p.label])).toEqual([
      ['a', undefined],
      ['b', undefined],
    ]);
    expect(checkRules(next)).toEqual([]);
  });

  it('元のデータは書き換えない', () => {
    const ch: Channel = { id: newId(), accounts: { youtube: { handle: 'foo' } }, phrases: [] };
    const data = dataWith(ch);
    addPhraseToChannel(data, { site: 'youtube', handle: 'foo' }, 'b');
    expect(ch.phrases).toEqual([]);
  });

  it('未登録のチャンネルは登録してから追加し、「グループなし」の最後に入れる', () => {
    const data = dataWith({ id: newId(), accounts: { youtube: { handle: 'other' } }, phrases: [] });
    const next = addPhraseToChannel(data, { site: 'youtube', handle: 'foo', siteChannelId: 'UCabcdefghijklmnopqrstuv' }, 'hello')!;
    const id = next.ungroupedChannelIds.at(-1)!;
    expect(next.channels[id]).toMatchObject({
      accounts: { youtube: { handle: 'foo', siteChannelId: 'UCabcdefghijklmnopqrstuv' } },
      phrases: [{ text: 'hello' }],
    });
    expect(next.channels[id]!.name).toBeUndefined();
    expect(checkRules(next)).toEqual([]);
  });

  it('前後の空白は残し、空白だけのときは追加しない', () => {
    const data = createEmptyData();
    const next = addPhraseToChannel(data, { site: 'youtube', handle: 'foo' }, ' a ')!;
    expect(Object.values(next.channels)[0]!.phrases[0]!.text).toBe(' a ');
    expect(addPhraseToChannel(data, { site: 'youtube', handle: 'foo' }, '   ')).toBeNull();
  });

  it('チャンネルが分からないときは追加しない', () => {
    expect(addPhraseToChannel(createEmptyData(), { site: 'youtube' }, 'a')).toBeNull();
  });
});
