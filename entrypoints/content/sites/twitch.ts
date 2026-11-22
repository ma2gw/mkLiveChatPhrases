/**
 * Twitch のページを読む処理
 *
 * 配信のページは https://www.twitch.tv/<名前>。この <名前>（ログイン名）をそのままハンドルとして使う
 * - パスが 1 段だけで、Twitch の機能のページ（/directory など）ではないものを、チャンネルのページとみなす
 * - Twitch も SPA なので、URL が変わったことを WXT の wxt:locationchange で知る（少し待ってから読む）
 * 失敗したときは例外を投げずに null を返し、Twitch のページを壊さない
 */
import type { PageChannel } from '../../../lib/model/match';
import type { SiteAdapter } from '.';

/** ログイン名の形（英数字と _。今は 4〜25 文字だが、古いアカウントのために 3 文字から受け付ける） */
const LOGIN = /^[a-z0-9_]{3,25}$/i;

/**
 * パスが 1 段でも、チャンネルではない Twitch の機能のページ
 * （ログイン名として取れない名前もあるが、念のため並べておく）
 */
const RESERVED = new Set([
  'directory',
  'downloads',
  'drops',
  'friends',
  'inventory',
  'jobs',
  'login',
  'logout',
  'messages',
  'p',
  'payments',
  'prime',
  'search',
  'settings',
  'signup',
  'store',
  'subscriptions',
  'turbo',
  'videos',
  'wallet',
]);

/** パスからチャンネルを読む。チャンネルのページでなければ null */
export function parseTwitchPath(pathname: string): PageChannel | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 1) return null;
  const name = segments[0]!;
  if (!LOGIN.test(name) || RESERVED.has(name.toLowerCase())) return null;
  // ログイン名は大文字と小文字を区別しないので、小文字にそろえる
  return { site: 'twitch', handle: name.toLowerCase() };
}

export const twitchAdapter: SiteAdapter = {
  site: 'twitch',
  hosts: ['www.twitch.tv'],
  isTargetPage: (location) => parseTwitchPath(location.pathname) !== null,
  getPageChannel: () => parseTwitchPath(location.pathname),
  watchPage(ctx, callback) {
    // URL が変わったら（SPA の画面遷移）呼ぶ
    // wxt:locationchange は Navigation API の navigate（移動を始める時点）で届き、まだ location が古い。
    // そのため少し待ってから呼ぶ（短い間に何度か届いても 1 回にまとめる）
    let timer: ReturnType<typeof setTimeout> | undefined;
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      clearTimeout(timer);
      timer = setTimeout(callback, 150);
    });
    ctx.onInvalidated(() => clearTimeout(timer));
    callback();
  },
  // Twitch はダークテーマのとき <html> に tw-root--theme-dark が付く
  isDarkTheme: () => document.documentElement.classList.contains('tw-root--theme-dark'),
};
