import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { adapterFor } from '../entrypoints/content/sites';
import { parseTwitchPath } from '../entrypoints/content/sites/twitch';
import { isTargetPage, parseChannelHref } from '../entrypoints/content/sites/youtube';
import { shouldShowMenu } from '../entrypoints/content/visibility';

describe('サイトのアダプターを選ぶ', () => {
  it('ホスト名で選び、対応していなければ undefined', () => {
    expect(adapterFor('www.youtube.com')?.site).toBe('youtube');
    expect(adapterFor('www.twitch.tv')?.site).toBe('twitch');
    expect(adapterFor('example.com')).toBeUndefined();
  });
});

describe('Twitch のページを読む', () => {
  it.each([
    ['/foo_bar', { site: 'twitch', handle: 'foo_bar' }],
    ['/FooBar/', { site: 'twitch', handle: 'foobar' }], // 小文字にそろえる
    ['/', null],
    ['/directory', null], // Twitch の機能のページ
    ['/videos/123456', null], // 2 段以上はチャンネルのページではない
    ['/foo/videos', null],
    ['/ab', null], // ログイン名として短すぎる
    ['/foo-bar', null], // ログイン名に使えない文字
  ])('%s', (pathname, expected) => {
    expect(parseTwitchPath(pathname)).toEqual(expected);
  });
});
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
  it('Twitch のハンドルには @ を付けない。YouTube があれば YouTube を先に使う', () => {
    expect(channelDisplayName({ ...base, accounts: { twitch: { handle: 'foo' } } })).toBe('foo');
    expect(channelDisplayName({ ...base, accounts: { twitch: { handle: 'tw' }, youtube: { handle: 'yt' } } })).toBe('@yt');
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

describe('YouTube と Twitch の両方のアカウントを持つチャンネル', () => {
  const ch: Channel = {
    id: newId(),
    accounts: { youtube: { handle: 'yt_name' }, twitch: { handle: 'tw_name' } },
    phrases: [],
  };
  const data = createEmptyData();
  data.channels[ch.id] = ch;
  data.ungroupedChannelIds.push(ch.id);

  it('どちらのサイトのページからでも見つかる', () => {
    expect(findChannel(data, { site: 'youtube', handle: 'yt_name' })).toBe(ch);
    expect(findChannel(data, { site: 'twitch', handle: 'TW_NAME' })).toBe(ch);
  });
  it('サイトが違えば、同じ名前でも見つからない', () => {
    expect(findChannel(data, { site: 'twitch', handle: 'yt_name' })).toBeUndefined();
  });
});
