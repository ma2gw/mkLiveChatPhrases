import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../lib/model/compare';
import {
  addChannel,
  addGroup,
  addPhraseToChannel,
  deleteChannel,
  deleteGroup,
  mergeData,
  moveChannel,
  moveInArray,
  normalizeForSave,
  placeOf,
  sortChannelsByName,
} from '../lib/model/edit';
import { createEmptyData, newId, type Channel, type PhraseData } from '../lib/model/types';
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

describe('チャンネルを表示名の順に並べる', () => {
  it('グループの中だけを並べ、表示名がないチャンネルは最後', () => {
    const data = createEmptyData();
    const g = addGroup(data, 'G');
    const names = ['b', 'A', '', 'ch10', 'ch2'];
    const ids = names.map((name) => {
      const c = addChannel(data, g.id);
      if (name) c.name = name;
      return c.id;
    });
    const other = addChannel(data, null);
    other.name = 'z';
    const b = addChannel(data, null);
    b.name = 'a';
    sortChannelsByName(data, g.id);
    expect(g.channelIds.map((id) => data.channels[id]!.name ?? '')).toEqual(['A', 'b', 'ch2', 'ch10', '']);
    expect(new Set(g.channelIds)).toEqual(new Set(ids));
    // グループなしは並べていない
    expect(data.ungroupedChannelIds).toEqual([other.id, b.id]);
    sortChannelsByName(data, null);
    expect(data.ungroupedChannelIds).toEqual([b.id, other.id]);
  });
  it('名前がなければハンドルで並べる', () => {
    const data = createEmptyData();
    const x = addChannel(data, null);
    x.accounts.youtube = { handle: 'yy' };
    const y = addChannel(data, null);
    y.accounts.twitch = { handle: 'xx' };
    sortChannelsByName(data, null);
    expect(data.ungroupedChannelIds).toEqual([y.id, x.id]); // xx < @yy（記号は比べるときに無視される）
  });
});

describe('インポート（マージ）', () => {
  /** 今のデータ: 共通 1 つ、グループ「G」にチャンネル foo（YouTube） */
  function current(): PhraseData {
    const data = createEmptyData();
    data.globalPhrases.push({ id: 'g1', text: 'こんにちは' });
    const g = addGroup(data, 'G');
    const foo = addChannel(data, g.id);
    foo.name = 'Foo';
    foo.accounts.youtube = { handle: 'foo' };
    foo.phrases.push({ id: 'f1', text: 'ふー' });
    return data;
  }
  /** 読み込むデータ */
  function incoming(): PhraseData {
    const data = createEmptyData();
    data.globalPhrases.push({ id: 'x1', text: 'こんにちは' }, { id: 'x2', text: 'おつかれ', label: 'おつ' });
    const g = addGroup(data, 'G');
    const foo = addChannel(data, g.id);
    foo.name = '別の名前';
    foo.accounts.youtube = { handle: 'FOO' }; // 大文字と小文字が違っても同じチャンネル
    foo.phrases.push({ id: 'x3', text: 'ふー' }, { id: 'x4', text: 'ばー' });
    const bar = addChannel(data, g.id);
    bar.accounts.twitch = { handle: 'bar' };
    bar.phrases.push({ id: 'x5', text: 'ばー' });
    const h = addGroup(data, 'H');
    const baz = addChannel(data, h.id);
    baz.accounts.youtube = { siteChannelId: 'UCabcdefghijklmnopqrstuv' };
    const qux = addChannel(data, null);
    qux.accounts.youtube = { handle: 'qux' };
    return data;
  }

  it('同じ文はない定型文だけを足し、登録していないチャンネルを置き場所ごとに足す', () => {
    const data = current();
    const src = incoming();
    const before = canonicalJson(src);
    const summary = mergeData(data, src);
    expect(summary).toEqual({ addedGroups: 1, addedChannels: 3, updatedChannels: 1, addedPhrases: 3 });
    // incoming は書き換えない
    expect(canonicalJson(src)).toBe(before);

    expect(data.globalPhrases.map((p) => [p.text, p.label])).toEqual([
      ['こんにちは', undefined],
      ['おつかれ', 'おつ'],
    ]);
    const [g, h] = data.groups;
    expect(data.groups.map((x) => x.name)).toEqual(['G', 'H']);
    // 今のチャンネルは、名前もそのままで定型文だけ増える
    const foo = data.channels[g!.channelIds[0]!]!;
    expect(foo.name).toBe('Foo');
    expect(foo.phrases.map((p) => p.text)).toEqual(['ふー', 'ばー']);
    // 新しいチャンネルは同じ名前のグループへ（なければ作る）、グループなしはグループなしへ
    expect(g!.channelIds).toHaveLength(2);
    expect(data.channels[g!.channelIds[1]!]!.accounts).toEqual({ twitch: { handle: 'bar' } });
    expect(data.channels[h!.channelIds[0]!]!.accounts).toEqual({ youtube: { siteChannelId: 'UCabcdefghijklmnopqrstuv' } });
    expect(data.ungroupedChannelIds.map((id) => data.channels[id]!.accounts.youtube?.handle)).toEqual(['qux']);
    // id はすべて作り直す
    const srcIds = new Set([...Object.keys(src.channels), 'x1', 'x2', 'x3', 'x4', 'x5']);
    const ids = [...Object.keys(data.channels), ...data.globalPhrases.map((p) => p.id), ...foo.phrases.map((p) => p.id)];
    expect(ids.some((id) => srcIds.has(id))).toBe(false);
    expect(checkRules(data)).toEqual([]);
  });

  it('登録済みのチャンネルに、ない表示名とないサイトのアカウントを補う（ほかのチャンネルが使っていれば補わない）', () => {
    const data = createEmptyData();
    const a = addChannel(data, null);
    a.accounts.youtube = { handle: 'a' };
    const b = addChannel(data, null);
    b.name = 'B';
    b.accounts.youtube = { handle: 'b' };
    const used = addChannel(data, null);
    used.accounts.twitch = { handle: 'used' };

    const src = createEmptyData();
    const sa = addChannel(src, null);
    sa.name = 'A の名前';
    sa.accounts = { youtube: { handle: 'a' }, twitch: { handle: 'a_tw' } };
    const sb = addChannel(src, null);
    sb.name = '別の名前';
    sb.accounts = { youtube: { handle: 'b' }, twitch: { handle: 'used' } };

    expect(mergeData(data, src)).toEqual({ addedGroups: 0, addedChannels: 0, updatedChannels: 1, addedPhrases: 0 });
    expect(a.name).toBe('A の名前');
    expect(a.accounts).toEqual({ youtube: { handle: 'a' }, twitch: { handle: 'a_tw' } });
    // 表示名はあるので今のまま。Twitch の used はほかのチャンネルが使っているので補わない
    expect(b.name).toBe('B');
    expect(b.accounts).toEqual({ youtube: { handle: 'b' } });
    expect(checkRules(data)).toEqual([]);
  });

  it('同じファイルを 2 回足しても、2 回目は何も増えない', () => {
    const data = current();
    mergeData(data, incoming());
    const once = canonicalJson(data);
    expect(mergeData(data, incoming())).toEqual({ addedGroups: 0, addedChannels: 0, updatedChannels: 0, addedPhrases: 0 });
    expect(canonicalJson(data)).toBe(once);
  });
});
