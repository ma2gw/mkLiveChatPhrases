/**
 * データを変更する処理
 *
 * - addPhraseToChannel: 渡されたデータは書き換えず、変更したコピーを返す（メニューの + で使う）
 * - それ以外: 渡されたデータを直接書き換える（編集画面の下書きに使う）
 */
import { findChannel, type PageChannel } from './match';
import { newId, SITES, type Channel, type Group, type PhraseData, type SiteAccount } from './types';
import { normalizeHandle } from './validate';

/**
 * 見ているチャンネルにフレーズを追加する（ラベルなし）
 * チャンネルが未登録なら、ページのサイト、ハンドル、チャンネル ID で登録してから追加する
 * （登録したチャンネルは「グループなし」の最後に入れる）
 * @returns 変更したデータ。text が空、またはページのチャンネルが分からないときは null
 */
export function addPhraseToChannel(data: PhraseData, page: PageChannel, text: string): PhraseData | null {
  // 前後の空白も定型文の一部として残す（空白だけのときは追加しない）
  if (!text.trim() || (!page.handle && !page.siteChannelId)) return null;

  const next = structuredClone(data);
  let channel = findChannel(next, page);
  if (!channel) {
    const created = newChannelFor(page);
    next.channels[created.id] = created;
    next.ungroupedChannelIds.push(created.id);
    channel = created;
  }
  channel.phrases.push({ id: newId(), text });
  return next;
}

/** ページのサイトのアカウント（ハンドル、チャンネル ID）を入れた、空のチャンネルを作る（データには入れない） */
export function newChannelFor(page: PageChannel): Channel {
  const account: SiteAccount = {};
  if (page.handle) account.handle = page.handle;
  if (page.siteChannelId) account.siteChannelId = page.siteChannelId;
  return { id: newId(), accounts: { [page.site]: account }, phrases: [] };
}

// ---------------------------------------------------------------------------
// ここから下は、渡されたデータを直接書き換える（編集画面の下書きに使う）
// チャンネルの置き場所は、グループの id か、「グループなし」を表す null で指定する
// ---------------------------------------------------------------------------

/**
 * 配列の from 番目を、to の位置へ動かす
 * to は「動かす前の配列」での挿入位置（0〜length）。ドラッグで「この行の前に落とした」をそのまま渡せる
 */
export function moveInArray<T>(list: T[], from: number, to: number): void {
  if (from < 0 || from >= list.length) return;
  const [item] = list.splice(from, 1);
  const index = to > from ? to - 1 : to;
  list.splice(Math.max(0, Math.min(index, list.length)), 0, item as T);
}

/** 置き場所（グループの id、グループなしは null）のチャンネルの並び */
function listOf(data: PhraseData, place: string | null): string[] | undefined {
  return place === null ? data.ungroupedChannelIds : data.groups.find((g) => g.id === place)?.channelIds;
}

/** チャンネルが入っている置き場所。グループなしは null、どこにもなければ undefined */
export function placeOf(data: PhraseData, channelId: string): string | null | undefined {
  if (data.ungroupedChannelIds.includes(channelId)) return null;
  return data.groups.find((g) => g.channelIds.includes(channelId))?.id;
}

/** チャンネルを、置き場所 to の toIndex の位置へ動かす（toIndex は動かす前の並びでの挿入位置） */
export function moveChannel(data: PhraseData, channelId: string, to: string | null, toIndex: number): void {
  const from = placeOf(data, channelId);
  const fromList = from === undefined ? undefined : listOf(data, from);
  const toList = listOf(data, to);
  if (!fromList || !toList) return;
  const fromIndex = fromList.indexOf(channelId);
  if (fromList === toList) {
    moveInArray(toList, fromIndex, toIndex);
    return;
  }
  fromList.splice(fromIndex, 1);
  toList.splice(Math.max(0, Math.min(toIndex, toList.length)), 0, channelId);
}

/** 空のチャンネル（アカウントもなし）を作り、置き場所 to の最後に入れる */
export function addChannel(data: PhraseData, to: string | null): Channel {
  const channel: Channel = { id: newId(), accounts: {}, phrases: [] };
  data.channels[channel.id] = channel;
  (listOf(data, to) ?? data.ungroupedChannelIds).push(channel.id);
  return channel;
}

/** チャンネルを消す */
export function deleteChannel(data: PhraseData, channelId: string): void {
  const remove = (list: string[]) => {
    const i = list.indexOf(channelId);
    if (i >= 0) list.splice(i, 1);
  };
  remove(data.ungroupedChannelIds);
  for (const g of data.groups) remove(g.channelIds);
  delete data.channels[channelId];
}

/** 空のグループを作り、最後に入れる */
export function addGroup(data: PhraseData, name: string): Group {
  const group: Group = { id: newId(), name, channelIds: [] };
  data.groups.push(group);
  return group;
}

/** グループを消す。中のチャンネルは「グループなし」の最後に移す */
export function deleteGroup(data: PhraseData, groupId: string): void {
  const index = data.groups.findIndex((g) => g.id === groupId);
  if (index < 0) return;
  const [group] = data.groups.splice(index, 1);
  data.ungroupedChannelIds.push(...(group?.channelIds ?? []));
}

/**
 * 保存する前に、入力の形をそろえる
 * - 空の名前、空のハンドル、空のチャンネル ID は持たない（省略と同じ意味になるため）
 * - 中身が空になったサイトのアカウントも持たない
 * - ハンドルは '@' を外し、decode する
 * - 空のラベルや、コピーする文字列と同じラベルは持たない
 * フレーズのコピーする文字列は、前後の空白も含めてそのまま残す
 */
export function normalizeForSave(data: PhraseData): void {
  const phrases = [...data.globalPhrases, ...Object.values(data.channels).flatMap((c) => c.phrases)];
  for (const p of phrases) {
    if (!p.label || p.label === p.text) delete p.label;
  }
  for (const ch of Object.values(data.channels)) {
    const name = ch.name?.trim();
    if (name) ch.name = name;
    else delete ch.name;
    for (const site of SITES) {
      const account = ch.accounts[site];
      if (!account) continue;
      const handle = account.handle ? normalizeHandle(account.handle) : '';
      if (handle) account.handle = handle;
      else delete account.handle;
      const siteChannelId = account.siteChannelId?.trim();
      if (siteChannelId) account.siteChannelId = siteChannelId;
      else delete account.siteChannelId;
      if (!account.handle && !account.siteChannelId) delete ch.accounts[site];
    }
  }
  for (const g of data.groups) g.name = g.name.trim();
}
