/**
 * 見ているページのチャンネルから、登録されたチャンネルを探す
 */
import type { Channel, PhraseData, Site } from './types';
import { handleKey } from './validate';

/** ページから分かったチャンネルの情報（ハンドルとチャンネル ID は、どちらか片方しか分からないこともある） */
export interface PageChannel {
  /** どのサイトのページか */
  site: Site;
  /** '@' を外し、decode したハンドル */
  handle?: string;
  /** サイトのチャンネル ID（YouTube なら 'UC...'） */
  siteChannelId?: string;
}

/** ページのサイトのアカウントを見て、チャンネル ID を優先し、なければハンドルで探す */
export function findChannel(data: PhraseData, page: PageChannel): Channel | undefined {
  const channels = Object.values(data.channels);
  const accountOf = (c: Channel) => c.accounts[page.site];
  const { siteChannelId, handle } = page;
  if (siteChannelId) {
    const found = channels.find((c) => accountOf(c)?.siteChannelId === siteChannelId);
    if (found) return found;
  }
  if (handle) {
    const key = handleKey(handle);
    return channels.find((c) => {
      const h = accountOf(c)?.handle;
      return h !== undefined && handleKey(h) === key;
    });
  }
  return undefined;
}
