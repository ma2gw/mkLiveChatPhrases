/**
 * サイトごとのページを読む処理（アダプター）
 *
 * content script はホスト名からアダプターを選び、サイトによらず同じ形で使う
 * サイトを足すときは、このフォルダにファイルを作って ADAPTERS に足し、
 * lib/model/types.ts の SITES / SITE_INFO と、index.ts の matches にも足す
 */
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { PageChannel } from '../../../lib/model/match';
import type { Site } from '../../../lib/model/types';
import { twitchAdapter } from './twitch';
import { youtubeAdapter } from './youtube';

export interface SiteAdapter {
  site: Site;
  /** このアダプターを使うホスト名 */
  hosts: readonly string[];
  /** メニューを出すページか */
  isTargetPage(location: { pathname: string }): boolean;
  /** 見ているページのチャンネル。分からなければ null（例外は投げない） */
  getPageChannel(): PageChannel | null;
  /** ページやチャンネルが変わったかもしれないときに callback を呼ぶ（最初にも 1 回呼ぶ） */
  watchPage(ctx: ContentScriptContext, callback: () => void): void;
  /** サイトがダークテーマか */
  isDarkTheme(): boolean;
}

export const ADAPTERS: readonly SiteAdapter[] = [youtubeAdapter, twitchAdapter];

/** ホスト名からアダプターを選ぶ。対応していなければ undefined */
export function adapterFor(hostname: string): SiteAdapter | undefined {
  return ADAPTERS.find((a) => a.hosts.includes(hostname));
}
