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
  if (page.youtubeChannelId) {
    const found = channels.find((c) => c.youtubeChannelIds.includes(page.youtubeChannelId!));
    if (found) return found;
  }
  if (page.handle) {
    const key = handleKey(page.handle);
    return channels.find((c) => c.handles.some((h) => handleKey(h) === key));
  }
  return undefined;
}
