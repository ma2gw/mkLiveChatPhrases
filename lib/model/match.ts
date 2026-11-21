/**
 * 見ているページのチャンネルから、登録されたチャンネルを探す
 */
import type { Channel, PhraseData } from './types';
import { handleKey } from './validate';

/** ページから分かったチャンネルの情報（どちらか片方しか分からないこともある） */
export interface PageChannel {
  /** '@' を外し、decode したハンドル */
  handle?: string;
  /** 'UC...' */
  youtubeChannelId?: string;
}

/** YouTube のチャンネル ID を優先し、なければハンドルで探す */
export function findChannel(data: PhraseData, page: PageChannel): Channel | undefined {
  const channels = Object.values(data.channels);
  const { youtubeChannelId, handle } = page;
  if (youtubeChannelId) {
    const found = channels.find((c) => c.youtubeChannelId === youtubeChannelId);
    if (found) return found;
  }
  if (handle) {
    const key = handleKey(handle);
    return channels.find((c) => c.handle !== undefined && handleKey(c.handle) === key);
  }
  return undefined;
}
