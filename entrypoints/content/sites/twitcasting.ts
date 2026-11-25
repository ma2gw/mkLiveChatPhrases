/**
 * ツイキャス（TwitCasting）のページを読む処理
 *
 * 配信のページは https://twitcasting.tv/<ID>。この <ID> をそのままハンドルとして使う
 * - ID は英数字と _ のもの（例: foo_bar）と、頭に「c:」「g:」などが付くもの（例: c:foo、g:123…）がある
 * - 配信中の一覧のリンクは /<ID>/movie/<番号> の形なので、このページにも出す（過去の配信のページも同じ形）
 * - /rankingindex.php などのサイトの機能のページは、ID に使えない文字（.）を含むので除かれる
 * - ページの切り替えは読み込み直しのことが多いが、念のため Twitch と同じく URL の変化も見張る
 * 失敗したときは例外を投げずに null を返し、ツイキャスのページを壊さない
 */
import type { PageChannel } from '../../../lib/model/match';
import type { SiteAdapter } from '.';

/** ID の形（「c:」などの印は英字のみ、その後ろは英数字と _） */
const USER_ID = /^(?:[a-z]+:)?[a-z0-9_]+$/i;

/** パスからチャンネルを読む。メニューを出すページでなければ null */
export function parseTwitcastingPath(pathname: string): PageChannel | null {
  let segments: string[];
  try {
    // 「:」が %3A になっていることがあるので、戻してから読む
    segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
  const [id, sub, movieId] = segments;
  if (!id || !USER_ID.test(id)) return null;
  const isUserPage = segments.length === 1;
  const isMoviePage = segments.length === 3 && sub === 'movie' && /^\d+$/.test(movieId!);
  if (!isUserPage && !isMoviePage) return null;
  // ID は大文字と小文字を区別しない（リンクは小文字）ので、小文字にそろえる
  return { site: 'twitcasting', handle: id.toLowerCase() };
}

/** 背景の色が暗ければダークテーマとみなす（ツイキャスのテーマの印が分からないため、色で見る） */
function hasDarkBackground(): boolean {
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
    if (!m || m.length < 3) continue;
    const [r, g, b, a = 1] = m.map(Number) as [number, number, number, number?];
    if (a === 0) continue; // 透明なら次（html）を見る
    return 0.299 * r + 0.587 * g + 0.114 * b < 128;
  }
  return false;
}

export const twitcastingAdapter: SiteAdapter = {
  site: 'twitcasting',
  hosts: ['twitcasting.tv'],
  isTargetPage: (location) => parseTwitcastingPath(location.pathname) !== null,
  getPageChannel: () => parseTwitcastingPath(location.pathname),
  watchPage(ctx, callback) {
    // URL が変わったら呼ぶ（wxt:locationchange は location が変わる前に届くので、少し待つ）
    let timer: ReturnType<typeof setTimeout> | undefined;
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      clearTimeout(timer);
      timer = setTimeout(callback, 150);
    });
    ctx.onInvalidated(() => clearTimeout(timer));
    callback();
  },
  isDarkTheme: hasDarkBackground,
};
