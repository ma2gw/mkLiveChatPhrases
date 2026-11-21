import { describe, expect, it } from 'vitest';
import { isTargetPage, parseChannelHref } from '../entrypoints/content/youtube';
import { findChannel } from '../lib/model/match';
import { createEmptyData, newId, type Channel } from '../lib/model/types';

describe('メニューを出すページ', () => {
  it.each([
    ['/watch', true],
    ['/live/abcdefghijk', true],
    ['/', false],
    ['/@foo', false],
    ['/live_chat', false],
    ['/watchlater', false],
  ])('%s → %s', (pathname, expected) => {
    expect(isTargetPage({ pathname })).toBe(expected);
  });
});

describe('チャンネルへのリンクを読む', () => {
  it.each([
    ['/@foo', { handle: 'foo' }],
    ['/@foo/videos', { handle: 'foo' }],
    ['https://www.youtube.com/@foo', { handle: 'foo' }],
    ['/@%E3%83%86%E3%82%B9%E3%83%88', { handle: 'テスト' }],
    ['/channel/UCabcdefghijklmnopqrstuv', { youtubeChannelId: 'UCabcdefghijklmnopqrstuv' }],
    ['/watch?v=abc', null],
    ['/@', null],
  ])('%s', (href, expected) => {
    expect(parseChannelHref(href)).toEqual(expected);
  });
});

describe('登録されたチャンネルを探す', () => {
  const ch: Channel = {
    id: newId(),
    name: 'Foo',
    handles: ['FooBar', 'foo_alt'],
    youtubeChannelIds: ['UCabcdefghijklmnopqrstuv'],
    phrases: [],
  };
  const data = createEmptyData();
  data.channels[ch.id] = ch;
  data.ungroupedChannelIds.push(ch.id);

  it('ハンドルの別名でも、大文字と小文字が違っても見つかる', () => {
    expect(findChannel(data, { handle: 'foobar' })).toBe(ch);
    expect(findChannel(data, { handle: 'FOO_ALT' })).toBe(ch);
  });
  it('YouTube のチャンネル ID で見つかる', () => {
    expect(findChannel(data, { youtubeChannelId: 'UCabcdefghijklmnopqrstuv' })).toBe(ch);
  });
  it('登録されていなければ undefined', () => {
    expect(findChannel(data, { handle: 'other' })).toBeUndefined();
    expect(findChannel(data, {})).toBeUndefined();
  });
});
