/**
 * データの形のチェックと、型では表せない決まりのチェック
 *
 * エラーは文言ではなくコードで返す（画面に出すときに _locales から文言を引く）
 */
import { SCHEMA_VERSION, type Channel, type Group, type Phrase, type PhraseData } from './types';

export type ErrorCode =
  /** JSON として読めない */
  | 'invalidJson'
  /** この拡張機能のデータではない */
  | 'unsupportedFormat'
  /** 新しいバージョンの拡張機能で作られたデータ（別の PC で先に更新した場合など） */
  | 'newerSchemaVersion'
  /** 項目の型が違う、必須の項目がない（detail に場所） */
  | 'invalidShape'
  /** 同じ id が 2 回出てくる（detail に id） */
  | 'duplicateId'
  /** チャンネルがどこにも入っていない、または 2 か所以上に入っている（detail にチャンネルの id） */
  | 'channelPlacement'
  /** groups / ungroupedChannelIds が存在しないチャンネルを指している（detail に id） */
  | 'unknownChannelRef'
  /** 同じハンドルが 2 つのチャンネルに登録されている（detail にハンドル） */
  | 'duplicateHandle'
  /** 同じ YouTube のチャンネル ID が 2 つのチャンネルに登録されている（detail に ID） */
  | 'duplicateYoutubeChannelId'
  /** storage.sync の 1 項目 8KB を超える（detail にキー） */
  | 'itemTooLarge'
  /** storage.sync の全体 100KB を超える */
  | 'totalTooLarge'
  /** storage.sync のキーの数 512 を超える */
  | 'tooManyItems';

export interface DataError {
  code: ErrorCode;
  detail?: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: DataError[] };

// ---------------------------------------------------------------------------
// ハンドル
// ---------------------------------------------------------------------------

/**
 * 保存する形のハンドルにする
 * '@foo' / '/@foo' / '%E3%83%86...'（URL エンコードされた日本語）を 'foo' / 'テ...' にそろえる
 */
export function normalizeHandle(raw: string): string {
  let s = raw.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    // 不正な % を含むときは decode せずにそのまま使う
  }
  return s.replace(/^\/?@/, '');
}

/** ハンドルを比べるためのキー（大文字と小文字を区別しない） */
export function handleKey(raw: string): string {
  return normalizeHandle(raw).toLowerCase();
}

// ---------------------------------------------------------------------------
// 形のチェック（unknown → 型付きの値）
// 知らない項目は捨て、必要な項目だけで新しいオブジェクトを作る
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

export function parsePhrase(v: unknown, path: string, errors: DataError[]): Phrase | null {
  if (!isObject(v) || !isNonEmptyString(v.id) || !isNonEmptyString(v.text)) {
    errors.push({ code: 'invalidShape', detail: path });
    return null;
  }
  if (v.label !== undefined && typeof v.label !== 'string') {
    errors.push({ code: 'invalidShape', detail: `${path}.label` });
    return null;
  }
  const phrase: Phrase = { id: v.id, text: v.text };
  // 空の label や text と同じ label は持たない（省略したときと同じ表示になるため）
  if (v.label && v.label !== v.text) phrase.label = v.label;
  return phrase;
}

function parsePhrases(v: unknown, path: string, errors: DataError[]): Phrase[] | null {
  if (!Array.isArray(v)) {
    errors.push({ code: 'invalidShape', detail: path });
    return null;
  }
  const phrases = v.map((p, i) => parsePhrase(p, `${path}[${i}]`, errors));
  return phrases.every((p) => p !== null) ? phrases : null;
}

export function parseChannel(v: unknown, path: string, errors: DataError[]): Channel | null {
  if (
    !isObject(v) ||
    !isNonEmptyString(v.id) ||
    typeof v.name !== 'string' ||
    !isStringArray(v.handles) ||
    !isStringArray(v.youtubeChannelIds)
  ) {
    errors.push({ code: 'invalidShape', detail: path });
    return null;
  }
  const phrases = parsePhrases(v.phrases, `${path}.phrases`, errors);
  if (!phrases) return null;
  return {
    id: v.id,
    name: v.name,
    handles: v.handles.map(normalizeHandle).filter((h) => h.length > 0),
    youtubeChannelIds: v.youtubeChannelIds.map((s) => s.trim()).filter((s) => s.length > 0),
    phrases,
  };
}

export function parseGroup(v: unknown, path: string, errors: DataError[]): Group | null {
  if (!isObject(v) || !isNonEmptyString(v.id) || typeof v.name !== 'string' || !isStringArray(v.channelIds)) {
    errors.push({ code: 'invalidShape', detail: path });
    return null;
  }
  return { id: v.id, name: v.name, channelIds: [...v.channelIds] };
}

/**
 * 今のバージョンの PhraseData として読む（形のチェックと決まりのチェックの両方）
 * 古いバージョンからの移行は、呼ぶ前に済ませておく
 */
export function parsePhraseData(v: unknown): Result<PhraseData> {
  const errors: DataError[] = [];
  if (!isObject(v)) return { ok: false, errors: [{ code: 'invalidShape', detail: '(root)' }] };
  if (typeof v.schemaVersion !== 'number') return { ok: false, errors: [{ code: 'invalidShape', detail: 'schemaVersion' }] };
  if (v.schemaVersion > SCHEMA_VERSION) return { ok: false, errors: [{ code: 'newerSchemaVersion', detail: String(v.schemaVersion) }] };
  if (v.schemaVersion !== SCHEMA_VERSION) return { ok: false, errors: [{ code: 'invalidShape', detail: 'schemaVersion' }] };

  const globalPhrases = parsePhrases(v.globalPhrases, 'globalPhrases', errors);

  let groups: Group[] | null = null;
  if (Array.isArray(v.groups)) {
    const parsed = v.groups.map((g, i) => parseGroup(g, `groups[${i}]`, errors));
    if (parsed.every((g) => g !== null)) groups = parsed;
  } else {
    errors.push({ code: 'invalidShape', detail: 'groups' });
  }

  const ungroupedChannelIds = isStringArray(v.ungroupedChannelIds) ? [...v.ungroupedChannelIds] : null;
  if (!ungroupedChannelIds) errors.push({ code: 'invalidShape', detail: 'ungroupedChannelIds' });

  const channels: Record<string, Channel> = {};
  if (isObject(v.channels)) {
    for (const [key, raw] of Object.entries(v.channels)) {
      const ch = parseChannel(raw, `channels.${key}`, errors);
      if (!ch) continue;
      if (ch.id !== key) {
        errors.push({ code: 'invalidShape', detail: `channels.${key}.id` });
        continue;
      }
      channels[key] = ch;
    }
  } else {
    errors.push({ code: 'invalidShape', detail: 'channels' });
  }

  if (errors.length > 0 || !globalPhrases || !groups || !ungroupedChannelIds) {
    return { ok: false, errors };
  }
  const data: PhraseData = { schemaVersion: SCHEMA_VERSION, globalPhrases, groups, ungroupedChannelIds, channels };
  const ruleErrors = checkRules(data);
  return ruleErrors.length > 0 ? { ok: false, errors: ruleErrors } : { ok: true, value: data };
}

// ---------------------------------------------------------------------------
// 型では表せない決まりのチェック
// ---------------------------------------------------------------------------

/** 保存する前に呼ぶ。空の配列が返れば問題なし */
export function checkRules(data: PhraseData): DataError[] {
  const errors: DataError[] = [];

  // id の重複（グループ、チャンネル、フレーズはそれぞれの中で一意）
  const checkUnique = (ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push({ code: 'duplicateId', detail: id });
      seen.add(id);
    }
  };
  const channels = Object.values(data.channels);
  checkUnique(data.groups.map((g) => g.id));
  checkUnique([...data.globalPhrases, ...channels.flatMap((c) => c.phrases)].map((p) => p.id));

  // どのチャンネルも、どこか 1 か所だけに入っている
  const placed = new Map<string, number>();
  for (const id of [...data.groups.flatMap((g) => g.channelIds), ...data.ungroupedChannelIds]) {
    if (!(id in data.channels)) errors.push({ code: 'unknownChannelRef', detail: id });
    placed.set(id, (placed.get(id) ?? 0) + 1);
  }
  for (const ch of channels) {
    if (placed.get(ch.id) !== 1) errors.push({ code: 'channelPlacement', detail: ch.id });
  }

  // 同じハンドルや YouTube のチャンネル ID を 2 つのチャンネルに登録しない
  const checkOwners = (code: ErrorCode, keysOf: (c: Channel) => string[]) => {
    const owner = new Map<string, string>();
    for (const ch of channels) {
      for (const key of new Set(keysOf(ch))) {
        const other = owner.get(key);
        if (other !== undefined && other !== ch.id) errors.push({ code, detail: key });
        owner.set(key, ch.id);
      }
    }
  };
  checkOwners('duplicateHandle', (c) => c.handles.map(handleKey));
  checkOwners('duplicateYoutubeChannelId', (c) => c.youtubeChannelIds);

  return errors;
}
