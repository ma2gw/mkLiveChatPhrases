import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { isTargetPage, parseChannelHref, shouldShowMenu } from '../entrypoints/content/youtube';
import { loadMenuHidden, saveMenuHidden } from '../lib/storage/menuHidden';

describe('メニューを出すかどうか', () => {
  const base = { targetPage: true, hidden: false, hideUnregistered: false, registered: false };
  it('出すページで、隠していなければ出す（未登録でも）', () => {
    expect(shouldShowMenu(base)).toBe(true);
  });
  it('出すページでなければ出さない', () => {
    expect(shouldShowMenu({ ...base, targetPage: false })).toBe(false);
  });
  it('ツールバーのアイコンで隠していれば、登録済みでも出さない', () => {
    expect(shouldShowMenu({ ...base, hidden: true, registered: true })).toBe(false);
  });
  it('「未登録では出さない」がオンなら、登録済みのチャンネルでだけ出す', () => {
    expect(shouldShowMenu({ ...base, hideUnregistered: true })).toBe(false);
    expect(shouldShowMenu({ ...base, hideUnregistered: true, registered: true })).toBe(true);
  });
});

describe('メニューを隠しているかの保存', () => {
  beforeEach(() => fakeBrowser.reset());
  it('何も保存されていなければ隠していない。保存したものを読める', async () => {
    expect(await loadMenuHidden()).toBe(false);
    await saveMenuHidden(true);
    expect(await loadMenuHidden()).toBe(true);
  });
});
import { findChannel } from '../lib/model/match';
import { channelDisplayName, createEmptyData, newId, type Channel } from '../lib/model/types';

describe('チャンネルの表示名', () => {
  const base: Channel = { id: 'x', accounts: {}, phrases: [] };
  it('name があれば name', () => {
    expect(channelDisplayName({ ...base, name: '名前', accounts: { youtube: { handle: 'foo' } } })).toBe('名前');
  });
  it('name がなければハンドル', () => {
    const accounts = { youtube: { handle: 'foo', siteChannelId: 'UCabcdefghijklmnopqrstuv' } };
    expect(channelDisplayName({ ...base, accounts })).toBe('@foo');
  });
  it('ハンドルもなければチャンネル ID', () => {
    const accounts = { youtube: { siteChannelId: 'UCabcdefghijklmnopqrstuv' } };
    expect(channelDisplayName({ ...base, accounts })).toBe('UCabcdefghijklmnopqrstuv');
  });
  it('アカウントがなければ空', () => {
    expect(channelDisplayName(base)).toBe('');
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
    ['/@foo', { site: 'youtube', handle: 'foo' }],
    ['/@foo/videos', { site: 'youtube', handle: 'foo' }],
    ['https://www.youtube.com/@foo', { site: 'youtube', handle: 'foo' }],
    ['/@%E3%83%86%E3%82%B9%E3%83%88', { site: 'youtube', handle: 'テスト' }],
    ['/channel/UCabcdefghijklmnopqrstuv', { site: 'youtube', siteChannelId: 'UCabcdefghijklmnopqrstuv' }],
    ['/watch?v=abc', null],
    ['/@', null],
  ])('%s', (href, expected) => {
    expect(parseChannelHref(href)).toEqual(expected);
  });
});

describe('登録されたチャンネルを探す', () => {
  const ch: Channel = {
    id: newId(),
    accounts: { youtube: { handle: 'FooBar', siteChannelId: 'UCabcdefghijklmnopqrstuv' } },
    phrases: [],
  };
  const ucOnly: Channel = { id: newId(), accounts: { youtube: { siteChannelId: 'UCzzzzzzzzzzzzzzzzzzzzzz' } }, phrases: [] };
  const data = createEmptyData();
  for (const c of [ch, ucOnly]) {
    data.channels[c.id] = c;
    data.ungroupedChannelIds.push(c.id);
  }

  it('大文字と小文字が違ってもハンドルで見つかる', () => {
    expect(findChannel(data, { site: 'youtube', handle: 'foobar' })).toBe(ch);
  });
  it('YouTube のチャンネル ID で見つかる', () => {
    expect(findChannel(data, { site: 'youtube', siteChannelId: 'UCabcdefghijklmnopqrstuv' })).toBe(ch);
    expect(findChannel(data, { site: 'youtube', siteChannelId: 'UCzzzzzzzzzzzzzzzzzzzzzz' })).toBe(ucOnly);
  });
  it('登録されていなければ undefined', () => {
    expect(findChannel(data, { site: 'youtube', handle: 'other' })).toBeUndefined();
    expect(findChannel(data, { site: 'youtube' })).toBeUndefined();
  });
});
