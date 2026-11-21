import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createEmptyData, newId, type Channel, type PhraseData } from '../lib/model/types';
import { checkRules, handleKey, normalizeHandle } from '../lib/model/validate';
import { exportToJson, importFromJson } from '../lib/storage/importExport';
import { joinFromSync, loadData, NewerSchemaVersionError, saveData, splitForSync } from '../lib/storage/sync';

function makeChannel(handle: string, phraseCount = 1): Channel {
  return {
    id: newId(),
    name: handle,
    handle,
    phrases: Array.from({ length: phraseCount }, (_, i) => ({ id: newId(), text: `${handle} ${i}` })),
  };
}

/** チャンネルを「グループなし」に入れたデータを作る */
function makeData(...channels: Channel[]): PhraseData {
  const data = createEmptyData();
  for (const ch of channels) {
    data.channels[ch.id] = ch;
    data.ungroupedChannelIds.push(ch.id);
  }
  return data;
}

function unwrap<T>(r: { ok: true; value: T } | { ok: false; errors: unknown }): T {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
}

beforeEach(() => {
  fakeBrowser.reset();
});

describe('ハンドル', () => {
  it('@ や / を外し、URL エンコードされた日本語を戻す', () => {
    expect(normalizeHandle('@foo')).toBe('foo');
    expect(normalizeHandle('/@foo')).toBe('foo');
    expect(normalizeHandle('@%E3%83%86%E3%82%B9%E3%83%88')).toBe('テスト');
    expect(normalizeHandle('@100%')).toBe('100%'); // 不正な % はそのまま
  });
  it('大文字と小文字を区別せずに比べる', () => {
    expect(handleKey('@FooBar')).toBe(handleKey('foobar'));
  });
});

describe('JSON のエクスポートとインポート', () => {
  it('エクスポートしたものをインポートすると元に戻る', () => {
    const grouped = makeChannel('grouped', 2);
    grouped.phrases[0]!.label = 'label';
    grouped.youtubeChannelId = 'UCabcdefghijklmnopqrstuv';
    const ungrouped = makeChannel('ungrouped');
    delete ungrouped.name; // 名前を省略したチャンネル
    const data = makeData(grouped, ungrouped);
    data.ungroupedChannelIds = [ungrouped.id];
    data.groups.push({ id: newId(), name: 'group', channelIds: [grouped.id] });
    data.globalPhrases.push({ id: newId(), text: 'global' });

    expect(unwrap(importFromJson(exportToJson(data)))).toEqual(data);
  });

  it('決まりを守っていないデータはエラーにする', () => {
    const r = importFromJson(exportToJson(makeData(makeChannel('Foo'), makeChannel('foo'))));
    expect(r).toEqual({ ok: false, errors: [{ code: 'duplicateHandle', detail: 'foo' }] });
  });

  it('不正な JSON や知らない形はエラーにする', () => {
    const codes = (text: string) => {
      const r = importFromJson(text);
      return r.ok ? [] : r.errors.map((e) => e.code);
    };
    expect(codes('{ broken')).toEqual(['invalidJson']);
    expect(codes('[1, 2]')).toEqual(['unsupportedFormat']);
    expect(codes('{"foo": 1}')).toEqual(['unsupportedFormat']);
    expect(codes(JSON.stringify({ ...createEmptyData(), schemaVersion: 999 }))).toEqual(['newerSchemaVersion']);
    expect(codes(JSON.stringify({ ...createEmptyData(), channels: { a: { id: 'a' } } }))).toEqual(['invalidShape']);
  });
});

describe('決まりのチェック', () => {
  it('チャンネルがどこにも入っていない、または 2 か所に入っているとエラーにする', () => {
    const a = makeChannel('a');
    const b = makeChannel('b');
    const data = makeData(a);
    data.channels[b.id] = b; // どこにも入っていない
    data.groups.push({ id: newId(), name: 'g', channelIds: [a.id] }); // a は 2 か所目
    expect(checkRules(data).map((e) => e.code).sort()).toEqual(['channelPlacement', 'channelPlacement']);
  });

  it('ハンドルも YouTube のチャンネル ID もないチャンネルはエラーにする', () => {
    const ch = makeChannel('a');
    delete ch.handle;
    expect(checkRules(makeData(ch))).toEqual([{ code: 'missingChannelKey', detail: ch.id }]);
  });

  it('同じハンドルを 2 つのチャンネルに登録するとエラーにする', () => {
    expect(checkRules(makeData(makeChannel('Foo'), makeChannel('foo')))).toEqual([
      { code: 'duplicateHandle', detail: 'foo' },
    ]);
  });
});

describe('storage.sync への保存と読み込み', () => {
  it('キーを分けて保存し、読むと元に戻る', async () => {
    const a = makeChannel('a');
    const b = makeChannel('b');
    const data = makeData(a, b);
    data.globalPhrases.push({ id: newId(), text: '👏👏👏', label: '👏' });

    unwrap(await saveData(data));
    const stored = await fakeBrowser.storage.sync.get(null);
    expect(Object.keys(stored).sort()).toEqual(['ch:' + a.id, 'ch:' + b.id, 'global', 'meta'].sort());
    expect(await loadData()).toEqual(data);
  });

  it('何も保存されていなければ空のデータを返す', async () => {
    expect(await loadData()).toEqual(createEmptyData());
  });

  it('変わったキーだけを書き、消したチャンネルのキーは消す', async () => {
    const a = makeChannel('a');
    const b = makeChannel('b');
    const data = makeData(a, b);
    unwrap(await saveData(data));

    const set = vi.spyOn(fakeBrowser.storage.sync, 'set');
    a.phrases[0]!.text = 'changed';
    unwrap(await saveData(data));
    expect(Object.keys(set.mock.calls[0]![0] as object)).toEqual(['ch:' + a.id]);

    delete data.channels[b.id];
    data.ungroupedChannelIds = [a.id];
    unwrap(await saveData(data));
    const stored = await fakeBrowser.storage.sync.get(null);
    expect('ch:' + b.id in stored).toBe(false);
  });

  it('1 チャンネルが 8KB を超えるときは何も書かずにエラーを返す', async () => {
    const big = makeChannel('big');
    big.phrases = Array.from({ length: 50 }, () => ({ id: newId(), text: ':_絵文字:'.repeat(20) }));
    const r = await saveData(makeData(big));
    expect(r).toEqual({ ok: false, errors: [{ code: 'itemTooLarge', detail: 'ch:' + big.id }] });
    expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
  });

  it('新しいバージョンのデータが保存されていたら、読まず、上書きもしない', async () => {
    await fakeBrowser.storage.sync.set({ meta: { schemaVersion: 999, groups: [], ungroupedChannelIds: [] } });
    await expect(loadData()).rejects.toBeInstanceOf(NewerSchemaVersionError);
    const r = await saveData(createEmptyData());
    expect(r.ok).toBe(false);
  });
});

describe('キーどうしの整合が崩れたときの読み込み', () => {
  it('どこにも入っていないチャンネルは「グループなし」に入れ、存在しないチャンネルへの参照は消す', () => {
    const a = makeChannel('a');
    const b = makeChannel('b');
    const items = splitForSync(makeData(a));
    items['ch:' + b.id] = b; // 別の PC で追加され、meta がまだ届いていない
    items.meta = { schemaVersion: 1, groups: [{ id: 'g', name: 'g', channelIds: ['gone', a.id] }], ungroupedChannelIds: [a.id] };

    const data = joinFromSync(items);
    expect(data.groups[0]!.channelIds).toEqual([a.id]);
    expect(data.ungroupedChannelIds).toEqual([b.id]);
    expect(checkRules(data)).toEqual([]);
  });
});
