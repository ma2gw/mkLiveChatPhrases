import { describe, expect, it } from 'vitest';
import { isTargetPage, parseChannelHref } from '../entrypoints/content/youtube';
import { findChannel } from '../lib/model/match';
import { channelDisplayName, createEmptyData, newId, type Channel } from '../lib/model/types';

describe('チャンネルの表示名', () => {
  const base: Channel = { id: 'x', phrases: [] };
  it('name があれば name', () => {
    expect(channelDisplayName({ ...base, name: '名前', handle: 'foo' })).toBe('名前');
  });
  it('name がなければハンドル', () => {
    expect(channelDisplayName({ ...base, handle: 'foo', youtubeChannelId: 'UCabcdefghijklmnopqrstuv' })).toBe('@foo');
  });
  it('ハンドルもなければ YouTube のチャンネル ID', () => {
    expect(channelDisplayName({ ...base, youtubeChannelId: 'UCabcdefghijklmnopqrstuv' })).toBe('UCabcdefghijklmnopqrstuv');
  });
});

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
  const ch: Channel = { id: newId(), handle: 'FooBar', youtubeChannelId: 'UCabcdefghijklmnopqrstuv', phrases: [] };
  const ucOnly: Channel = { id: newId(), youtubeChannelId: 'UCzzzzzzzzzzzzzzzzzzzzzz', phrases: [] };
  const data = createEmptyData();
  for (const c of [ch, ucOnly]) {
    data.channels[c.id] = c;
    data.ungroupedChannelIds.push(c.id);
  }

  it('大文字と小文字が違ってもハンドルで見つかる', () => {
    expect(findChannel(data, { handle: 'foobar' })).toBe(ch);
  });
  it('YouTube のチャンネル ID で見つかる', () => {
    expect(findChannel(data, { youtubeChannelId: 'UCabcdefghijklmnopqrstuv' })).toBe(ch);
    expect(findChannel(data, { youtubeChannelId: 'UCzzzzzzzzzzzzzzzzzzzzzz' })).toBe(ucOnly);
  });
  it('登録されていなければ undefined', () => {
    expect(findChannel(data, { handle: 'other' })).toBeUndefined();
    expect(findChannel(data, {})).toBeUndefined();
  });
});
