/**
 * YouTube のページを読む処理
 *
 * YouTube の仕様が変わったときは、まず SELECTORS を直す
 * 失敗したときは例外を投げずに null を返し、YouTube のページを壊さない
 */
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { PageChannel } from '../../../lib/model/match';
import { normalizeHandle } from '../../../lib/model/validate';
import type { SiteAdapter } from '.';

/** YouTube の DOM のセレクタ（ここだけにまとめる） */
export const SELECTORS = {
  /** 動画の持ち主（チャンネル名とアイコンの部分） */
  ownerRenderer: 'ytd-watch-flexy ytd-video-owner-renderer',
  /** ownerRenderer の中の、チャンネルへのリンク */
  ownerLink: 'a[href^="/@"], a[href^="/channel/"]',
} as const;

/** メニューを出すページか（/watch と /live/...） */
export function isTargetPage(url: { pathname: string }): boolean {
  return url.pathname === '/watch' || url.pathname.startsWith('/live/');
}

/**
 * チャンネルへのリンクからハンドルまたはチャンネル ID を取り出す
 * '/@foo'、'/@foo/videos'、'/@%E3%83%86...'、'/channel/UC...' に対応する
 */
export function parseChannelHref(href: string): PageChannel | null {
  let path: string;
  try {
    path = new URL(href, 'https://www.youtube.com').pathname;
  } catch {
    return null;
  }
  const handle = path.match(/^\/(@[^/]+)/)?.[1];
  if (handle) {
    const normalized = normalizeHandle(handle);
    return normalized ? { site: 'youtube', handle: normalized } : null;
  }
  const siteChannelId = path.match(/^\/channel\/(UC[\w-]+)/)?.[1];
  return siteChannelId ? { site: 'youtube', siteChannelId } : null;
}

/** 見ている動画のチャンネルを調べる。分からなければ null */
export function getPageChannel(): PageChannel | null {
  try {
    const renderer = document.querySelector(SELECTORS.ownerRenderer);
    const href = renderer?.querySelector(SELECTORS.ownerLink)?.getAttribute('href');
    return href ? parseChannelHref(href) : null;
  } catch {
    return null;
  }
}

/**
 * ページやチャンネルが変わったかもしれないときに callback を呼ぶ
 * - SPA の画面遷移（yt-navigate-finish / yt-page-data-updated）
 * - 動画の持ち主の部分の書き換え（同じ要素が使い回されるので MutationObserver で見る）
 * 短い間に何度も起きるので、150ms 待ってからまとめて 1 回呼ぶ
 */
export function watchPage(ctx: ContentScriptContext, callback: () => void): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      ensureObserver();
      callback();
    }, 150);
  };

  // 動画の持ち主の要素は、画面遷移のあと少し遅れて作られる。見つかるまで何度か探す
  let observed: Element | null = null;
  const observer = new MutationObserver(schedule);
  const ensureObserver = (): boolean => {
    const target = document.querySelector(SELECTORS.ownerRenderer);
    if (!target) return false;
    if (target !== observed) {
      observer.disconnect();
      observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
      observed = target;
    }
    return true;
  };
  let retry: ReturnType<typeof setInterval> | undefined;
  const onNavigate = () => {
    schedule();
    clearInterval(retry);
    let count = 0;
    retry = setInterval(() => {
      if (ensureObserver() || ++count >= 20) clearInterval(retry);
      schedule();
    }, 500);
  };

  window.addEventListener('yt-navigate-finish', onNavigate);
  document.addEventListener('yt-page-data-updated', onNavigate);
  ctx.onInvalidated(() => {
    window.removeEventListener('yt-navigate-finish', onNavigate);
    document.removeEventListener('yt-page-data-updated', onNavigate);
    observer.disconnect();
    clearTimeout(timer);
    clearInterval(retry);
  });
  onNavigate();
}

export const youtubeAdapter: SiteAdapter = {
  site: 'youtube',
  hosts: ['www.youtube.com'],
  isTargetPage,
  getPageChannel,
  watchPage,
  // YouTube はダークテーマのとき <html> に dark が付く
  isDarkTheme: () => document.documentElement.hasAttribute('dark'),
};
