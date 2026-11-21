/**
 * データを変更する処理
 * 渡されたデータは書き換えず、変更したコピーを返す
 */
import { findChannel, type PageChannel } from './match';
import { newId, type Channel, type PhraseData } from './types';

/**
 * 見ているチャンネルにフレーズを追加する（ラベルなし）
 * チャンネルが未登録なら、ハンドルと YouTube のチャンネル ID で登録してから追加する
 * （登録したチャンネルは「グループなし」の最後に入れる）
 * @returns 変更したデータ。text が空、またはページのチャンネルが分からないときは null
 */
export function addPhraseToChannel(data: PhraseData, page: PageChannel, text: string): PhraseData | null {
  // 前後の空白も定型文の一部として残す（空白だけのときは追加しない）
  if (!text.trim() || (!page.handle && !page.youtubeChannelId)) return null;

  const next = structuredClone(data);
  let channel = findChannel(next, page);
  if (!channel) {
    const created: Channel = { id: newId(), phrases: [] };
    if (page.handle) created.handle = page.handle;
    if (page.youtubeChannelId) created.youtubeChannelId = page.youtubeChannelId;
    next.channels[created.id] = created;
    next.ungroupedChannelIds.push(created.id);
    channel = created;
  }
  channel.phrases.push({ id: newId(), text });
  return next;
}
