/**
 * storage.sync への保存と読み込み
 *
 * storage.sync は 1 項目 8KB の制限があるので、次のキーに分けて保存する
 *   meta     … schemaVersion、グループ、並び順（どのチャンネルがどこにどの順で入っているか）
 *   global   … 全チャンネル共通のフレーズ
 *   ch:<id>  … チャンネル 1 件分
 * キーを分けるのはこのモジュールの中だけで、外には PhraseData（入れ子の形）で渡す
 *
 * 書き込みの回数にも制限がある（1 分に 120 回、1 時間に 1800 回）ので、
 * 編集画面ではドラッグなどのたびに saveData を呼ばず、少し待ってまとめて呼ぶこと
 */
import { createEmptyData, SCHEMA_VERSION, type Channel, type Group, type Phrase, type PhraseData } from '../model/types';
import { checkRules, parseChannel, parseGroup, parsePhrase, type DataError, type Result } from '../model/validate';

const KEY_META = 'meta';
const KEY_GLOBAL = 'global';
const CHANNEL_PREFIX = 'ch:';

/** storage.sync の制限（Chrome の値。browser.storage.sync.QUOTA_* と同じ） */
export const SYNC_QUOTA = {
  bytesPerItem: 8192,
  bytes: 102400,
  maxItems: 512,
} as const;

interface SyncMeta {
  schemaVersion: number;
  groups: Group[];
  ungroupedChannelIds: string[];
}

/** 別の PC で新しいバージョンの拡張機能が保存したデータ。読めないし、上書きしてもいけない */
export class NewerSchemaVersionError extends Error {
  constructor(readonly storedVersion: number) {
    super(`stored schemaVersion ${storedVersion} is newer than ${SCHEMA_VERSION}`);
    this.name = 'NewerSchemaVersionError';
  }
}

// ---------------------------------------------------------------------------
// 分ける / 組み立て直す（storage を触らない部分。テストしやすいように分けている）
// ---------------------------------------------------------------------------

/** PhraseData を storage.sync のキーごとに分ける */
export function splitForSync(data: PhraseData): Record<string, unknown> {
  const meta: SyncMeta = {
    schemaVersion: data.schemaVersion,
    groups: data.groups,
    ungroupedChannelIds: data.ungroupedChannelIds,
  };
  const items: Record<string, unknown> = { [KEY_META]: meta, [KEY_GLOBAL]: data.globalPhrases };
  for (const ch of Object.values(data.channels)) items[CHANNEL_PREFIX + ch.id] = ch;
  return items;
}

/**
 * storage.sync から読んだキーを PhraseData に組み立て直す
 *
 * 2 台の PC で同時に編集した場合などに、キーどうしの整合が崩れることがある。
 * そのときはデータを捨てずに直す
 * - 壊れたチャンネルやグループは読み飛ばす
 * - 存在しないチャンネルへの参照や、2 か所目以降の参照は消す
 * - どこにも入っていないチャンネルは「グループなし」の末尾に入れる
 */
export function joinFromSync(items: Record<string, unknown>): PhraseData {
  const rawMeta = items[KEY_META] as Partial<SyncMeta> | undefined;
  if (typeof rawMeta?.schemaVersion === 'number' && rawMeta.schemaVersion > SCHEMA_VERSION) {
    throw new NewerSchemaVersionError(rawMeta.schemaVersion);
  }

  const ignored: DataError[] = [];
  const data = createEmptyData();

  if (Array.isArray(items[KEY_GLOBAL])) {
    data.globalPhrases = (items[KEY_GLOBAL] as unknown[])
      .map((p, i) => parsePhrase(p, `global[${i}]`, ignored))
      .filter((p): p is Phrase => p !== null);
  }

  for (const [key, raw] of Object.entries(items)) {
    if (!key.startsWith(CHANNEL_PREFIX)) continue;
    const ch = parseChannel(raw, key, ignored);
    if (ch && ch.id === key.slice(CHANNEL_PREFIX.length)) data.channels[ch.id] = ch;
  }

  const placed = new Set<string>();
  const takeIds = (ids: unknown): string[] =>
    (Array.isArray(ids) ? ids : []).filter((id): id is string => {
      if (typeof id !== 'string' || !(id in data.channels) || placed.has(id)) return false;
      placed.add(id);
      return true;
    });

  if (Array.isArray(rawMeta?.groups)) {
    for (const [i, raw] of rawMeta.groups.entries()) {
      const g = parseGroup(raw, `meta.groups[${i}]`, ignored);
      if (g) data.groups.push({ ...g, channelIds: takeIds(g.channelIds) });
    }
  }
  data.ungroupedChannelIds = takeIds(rawMeta?.ungroupedChannelIds);
  for (const id of Object.keys(data.channels)) {
    if (!placed.has(id)) data.ungroupedChannelIds.push(id);
  }

  if (ignored.length > 0) console.warn('[mkLiveChatPhrases] 壊れたデータを読み飛ばしました', ignored);
  return data;
}

function itemBytes(key: string, value: unknown): number {
  return new TextEncoder().encode(key + JSON.stringify(value)).length;
}

/** storage.sync の容量の制限に収まるか調べる */
export function checkSyncQuota(items: Record<string, unknown>): DataError[] {
  const errors: DataError[] = [];
  let total = 0;
  for (const [key, value] of Object.entries(items)) {
    const bytes = itemBytes(key, value);
    total += bytes;
    if (bytes > SYNC_QUOTA.bytesPerItem) errors.push({ code: 'itemTooLarge', detail: key });
  }
  if (total > SYNC_QUOTA.bytes) errors.push({ code: 'totalTooLarge', detail: String(total) });
  if (Object.keys(items).length > SYNC_QUOTA.maxItems) errors.push({ code: 'tooManyItems' });
  return errors;
}

/** チャンネルのキーの名前から、エラーに出すチャンネルを探す（画面でチャンネル名を出すため） */
export function channelOfKey(data: PhraseData, key: string): Channel | undefined {
  return key.startsWith(CHANNEL_PREFIX) ? data.channels[key.slice(CHANNEL_PREFIX.length)] : undefined;
}

// ---------------------------------------------------------------------------
// storage.sync を読み書きする
// ---------------------------------------------------------------------------

/**
 * データを読む。まだ何も保存されていなければ空のデータを返す
 * @throws NewerSchemaVersionError 新しいバージョンの拡張機能が保存したデータのとき
 */
export async function loadData(): Promise<PhraseData> {
  const items = await browser.storage.sync.get(null);
  return joinFromSync(items);
}

/**
 * データを保存する。中身が変わったキーだけを書き、消えたチャンネルのキーは消す
 * 決まりや容量の制限を守っていないときは、何も書かずにエラーを返す
 */
export async function saveData(data: PhraseData): Promise<Result<void>> {
  const ruleErrors = checkRules(data);
  if (ruleErrors.length > 0) return { ok: false, errors: ruleErrors };

  const next = splitForSync(data);
  const quotaErrors = checkSyncQuota(next);
  if (quotaErrors.length > 0) return { ok: false, errors: quotaErrors };

  const current = await browser.storage.sync.get(null);
  const storedVersion = (current[KEY_META] as Partial<SyncMeta> | undefined)?.schemaVersion;
  if (typeof storedVersion === 'number' && storedVersion > SCHEMA_VERSION) {
    return { ok: false, errors: [{ code: 'newerSchemaVersion', detail: String(storedVersion) }] };
  }

  const changed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    if (JSON.stringify(current[key]) !== JSON.stringify(value)) changed[key] = value;
  }
  const removed = Object.keys(current).filter((key) => key.startsWith(CHANNEL_PREFIX) && !(key in next));

  // 先に消してから書く。逆にすると、書いたあとで消すのに失敗したとき、
  // 消したはずのチャンネルが次に読んだときに「グループなし」に戻ってきてしまう
  if (removed.length > 0) await browser.storage.sync.remove(removed);
  if (Object.keys(changed).length > 0) await browser.storage.sync.set(changed);
  return { ok: true, value: undefined };
}

/**
 * 保存されたデータが変わったら（別の画面や別の PC で編集されたら）callback を呼ぶ
 * @returns 監視をやめる関数
 */
export function watchData(callback: (data: PhraseData) => void): () => void {
  const listener = (_changes: unknown, areaName: string) => {
    if (areaName !== 'sync') return;
    loadData().then(callback, (e) => console.warn('[mkLiveChatPhrases] データを読めませんでした', e));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
