import { describe, expect, it } from 'vitest';
import { addPhraseToChannel } from '../lib/model/edit';
import { createEmptyData, newId, type Channel } from '../lib/model/types';
import { checkRules } from '../lib/model/validate';

function dataWith(channel: Channel) {
  const data = createEmptyData();
  data.channels[channel.id] = channel;
  data.ungroupedChannelIds.push(channel.id);
  return data;
}

describe('+ でフレーズを追加する', () => {
  it('登録済みのチャンネルの最後に、ラベルなしで追加する', () => {
    const ch: Channel = { id: newId(), handle: 'foo', phrases: [{ id: newId(), text: 'a' }] };
    const data = dataWith(ch);
    const next = addPhraseToChannel(data, { handle: 'FOO' }, 'b')!;
    expect(next.channels[ch.id]!.phrases.map((p) => [p.text, p.label])).toEqual([
      ['a', undefined],
      ['b', undefined],
    ]);
    expect(checkRules(next)).toEqual([]);
  });

  it('元のデータは書き換えない', () => {
    const ch: Channel = { id: newId(), handle: 'foo', phrases: [] };
    const data = dataWith(ch);
    addPhraseToChannel(data, { handle: 'foo' }, 'b');
    expect(ch.phrases).toEqual([]);
  });

  it('未登録のチャンネルは登録してから追加し、「グループなし」の最後に入れる', () => {
    const data = dataWith({ id: newId(), handle: 'other', phrases: [] });
    const next = addPhraseToChannel(data, { handle: 'foo', youtubeChannelId: 'UCabcdefghijklmnopqrstuv' }, 'hello')!;
    const id = next.ungroupedChannelIds.at(-1)!;
    expect(next.channels[id]).toMatchObject({
      handle: 'foo',
      youtubeChannelId: 'UCabcdefghijklmnopqrstuv',
      phrases: [{ text: 'hello' }],
    });
    expect(next.channels[id]!.name).toBeUndefined();
    expect(checkRules(next)).toEqual([]);
  });

  it('前後の空白は残し、空白だけのときは追加しない', () => {
    const data = createEmptyData();
    const next = addPhraseToChannel(data, { handle: 'foo' }, ' a ')!;
    expect(Object.values(next.channels)[0]!.phrases[0]!.text).toBe(' a ');
    expect(addPhraseToChannel(data, { handle: 'foo' }, '   ')).toBeNull();
  });

  it('チャンネルが分からないときは追加しない', () => {
    expect(addPhraseToChannel(createEmptyData(), {}, 'a')).toBeNull();
  });
});
