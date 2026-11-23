/**
 * データを変更する処理
 *
 * - addPhraseToChannel: 渡されたデータは書き換えず、変更したコピーを返す（メニューの + で使う）
 * - それ以外: 渡されたデータを直接書き換える（編集画面の下書きに使う）
 */
import { findChannel, type PageChannel } from './match';
import {
  channelDisplayName,
  newId,
  SITES,
  type Channel,
  type Group,
  type Phrase,
  type PhraseData,
  type SiteAccount,
} from './types';
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
 * 表示名で比べる（大文字と小文字、全角と半角の違いは無視し、数字は数として比べる）
 * 記号も無視する（YouTube のハンドルの @ で、名前のないチャンネルが先頭に固まらないように）
 */
const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base', ignorePunctuation: true });

/**
 * 置き場所（グループの id、グループなしは null）のチャンネルを、表示名の順に並べ替える
 * 表示名がない（アカウントもない）チャンネルは最後に置く。同じ名前どうしは今の順のまま
 */
export function sortChannelsByName(data: PhraseData, place: string | null): void {
  const list = listOf(data, place);
  if (!list) return;
  const nameOf = (id: string) => {
    const channel = data.channels[id];
    return channel ? channelDisplayName(channel) : '';
  };
  const sorted = [...list].sort((a, b) => {
    const na = nameOf(a);
    const nb = nameOf(b);
    if (!na || !nb) return Number(!na) - Number(!nb);
    return nameCollator.compare(na, nb);
  });
  list.splice(0, list.length, ...sorted);
}

/** インポートで、何をどれだけ足したか */
export interface MergeSummary {
  /** 新しく作ったグループの数 */
  addedGroups: number;
  /** 新しく登録したチャンネルの数 */
  addedChannels: number;
  /** すでに登録していて、定型文や情報を足したチャンネルの数 */
  updatedChannels: number;
  /** 足した定型文の数（共通とチャンネルの合計） */
  addedPhrases: number;
}

/**
 * 読み込んだデータ（incoming）を、今のデータ（data）にマージする（インポート）
 * - 共通の定型文: 同じ文がなければ最後に足す
 * - すでに登録しているチャンネル（どれかのサイトで、同じハンドルか同じチャンネル ID）: 今のチャンネルに足す
 *   - 同じ文がない定型文を最後に足す
 *   - 表示名がなければ、ファイルの表示名を入れる（あれば今のまま）
 *   - 今のチャンネルにないサイトのアカウントを足す（ほかのチャンネルが使っていれば足さない）
 *   - 置き場所（グループ）は今のまま
 * - 登録していないチャンネル: 新しく登録する。ファイルでグループに入っていれば、同じ名前のグループの最後に入れる
 *   （同じ名前のグループがなければ作る）。グループに入っていなければ「グループなし」の最後に入れる
 * id はすべて作り直す（今のデータの id とぶつからないように）。incoming は書き換えない
 */
export function mergeData(data: PhraseData, incoming: PhraseData): MergeSummary {
  const summary: MergeSummary = { addedGroups: 0, addedChannels: 0, updatedChannels: 0, addedPhrases: 0 };

  /** 同じ文がない定型文だけを、新しい id で足す */
  const appendPhrases = (to: Phrase[], from: Phrase[]): number => {
    const texts = new Set(to.map((p) => p.text));
    let count = 0;
    for (const p of from) {
      if (texts.has(p.text)) continue;
      texts.add(p.text);
      to.push(p.label === undefined ? { id: newId(), text: p.text } : { id: newId(), text: p.text, label: p.label });
      count++;
    }
    return count;
  };

  summary.addedPhrases += appendPhrases(data.globalPhrases, incoming.globalPhrases);

  /** 同じ名前のグループのチャンネルの並び（なければ作る） */
  const groupList = (name: string): string[] => {
    const found = data.groups.find((g) => g.name.trim() === name.trim());
    if (found) return found.channelIds;
    addGroup(data, name);
    summary.addedGroups++;
    // 編集画面の下書き（Svelte の $state）では、入れたあとの要素から取り直す
    return data.groups[data.groups.length - 1]!.channelIds;
  };

  const places: { groupName: string | null; channelIds: string[] }[] = [
    ...incoming.groups.map((g) => ({ groupName: g.name, channelIds: g.channelIds })),
    { groupName: null, channelIds: incoming.ungroupedChannelIds },
  ];
  for (const { groupName, channelIds } of places) {
    for (const id of channelIds) {
      const channel = incoming.channels[id];
      if (!channel) continue;
      const existing = findExisting(data, channel);
      if (existing) {
        let changed = false;
        if (!existing.name && channel.name) {
          existing.name = channel.name;
          changed = true;
        }
        for (const site of SITES) {
          const account = channel.accounts[site];
          if (!account || existing.accounts[site] || findChannel(data, { site, ...account })) continue;
          existing.accounts[site] = { ...account };
          changed = true;
        }
        const added = appendPhrases(existing.phrases, channel.phrases);
        summary.addedPhrases += added;
        if (changed || added > 0) summary.updatedChannels++;
        continue;
      }
      // アカウントは 1 段ずつコピーする（structuredClone は Svelte の $state のプロキシを渡されると失敗するため）
      const accounts: Channel['accounts'] = {};
      for (const site of SITES) {
        const account = channel.accounts[site];
        if (account) accounts[site] = { ...account };
      }
      const created: Channel = { id: newId(), accounts, phrases: [] };
      if (channel.name !== undefined) created.name = channel.name;
      summary.addedPhrases += appendPhrases(created.phrases, channel.phrases);
      data.channels[created.id] = created;
      (groupName === null ? data.ungroupedChannelIds : groupList(groupName)).push(created.id);
      summary.addedChannels++;
    }
  }
  return summary;
}

/** どれかのサイトのアカウントで、すでに登録しているチャンネルを探す */
function findExisting(data: PhraseData, channel: Channel): Channel | undefined {
  for (const site of SITES) {
    const account = channel.accounts[site];
    if (!account) continue;
    const found = findChannel(data, { site, ...account });
    if (found) return found;
  }
  return undefined;
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
