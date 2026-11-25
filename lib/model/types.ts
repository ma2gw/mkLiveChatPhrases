/**
 * フレーズデータの型定義
 *
 * - プログラムの中で使う型とエクスポートする JSON は、この入れ子の形にそろえる
 * - storage.sync に保存するときは、保存と読み込みのモジュールの中でキーを分ける
 *   （meta / global / ch:<id>。1 項目 8KB の制限への対策）
 * - 形を変えるときは SCHEMA_VERSION を上げ、onInstalled でデータを移行する
 */

/** 今のデータの形のバージョン */
export const SCHEMA_VERSION = 1;

/** 定型文 1 件 */
export interface Phrase {
  id: string;
  /** クリップボードにコピーする文字列 */
  text: string;
  /** ボタンに表示する文字列。省略したら text を表示する */
  label?: string;
}

/**
 * 対応しているサイト。ほかのサイトに対応するときは、ここと SITE_INFO に足す
 * （ページを読む処理は entrypoints/content/sites/ に足す）
 */
export const SITES = ['youtube', 'twitch', 'twitcasting'] as const;
export type Site = (typeof SITES)[number];

/** サイトごとの見せ方（メニューと編集画面で使う） */
export const SITE_INFO: Record<
  Site,
  {
    /** 画面に出すサイトの名前（_locales のキー。言語で名前が変わるサイトがあるため） */
    labelKey: string;
    /** ハンドルを見せるときに前に付ける文字（YouTube とツイキャスは @、Twitch は付けない） */
    handlePrefix: string;
    /** チャンネル ID の欄の案内。チャンネル ID を使わないサイトは null（欄を出さない） */
    idPlaceholder: string | null;
  }
> = {
  youtube: { labelKey: 'siteYoutube', handlePrefix: '@', idPlaceholder: 'UC…' },
  // Twitch は URL の twitch.tv/<名前> の名前をハンドルとして使う。ユーザー ID は URL に出ないので使わない
  twitch: { labelKey: 'siteTwitch', handlePrefix: '', idPlaceholder: null },
  // ツイキャスは URL の twitcasting.tv/<ID> の ID（c:foo のような印つきのものも）をハンドルとして使う
  twitcasting: { labelKey: 'siteTwitcasting', handlePrefix: '@', idPlaceholder: null },
};

/** あるサイトでのアカウント（そのサイトのチャンネル 1 つ） */
export interface SiteAccount {
  /**
   * 見ているページがこのチャンネルかどうかを判定するためのハンドル（YouTube なら @ の後ろ）
   * '@' を外し、decodeURIComponent したものを保存する。比べるときは大文字と小文字を区別しない
   */
  handle?: string;
  /** サイトのチャンネル ID（YouTube なら 'UC...'）。ハンドルが変わっても判定できるように持つ */
  siteChannelId?: string;
}

/**
 * 定型文を登録するチャンネル（活動者 1 人。サイトごとに 1 つずつアカウントを持てる）
 * - フレーズはサイトをまたいで共通。サイトごとに分けたいときは、別のチャンネルとして登録する
 * - どれか 1 つのサイトのアカウントに、handle か siteChannelId が必要（checkRules で確かめる）
 * - ハンドルやチャンネル ID が重ならないかは、サイトごとに調べる（別のサイトに同じ名前があってもよい）
 */
export interface Channel {
  id: string;
  /** 表示する名前。省略したらハンドルを表示する（channelDisplayName を使う） */
  name?: string;
  /** サイトごとのアカウント。対応するサイトが増えたら、欄が増える */
  accounts: Partial<Record<Site, SiteAccount>>;
  /** 配列の順番がメニューでの並び順 */
  phrases: Phrase[];
}

/** サイトのハンドルの見せ方（YouTube なら @foo、Twitch なら foo） */
export function formatHandle(site: Site, handle: string): string {
  return `${SITE_INFO[site].handlePrefix}${handle}`;
}

/**
 * チャンネルの表示名
 * name がなければ、SITES の順で最初に見つかったハンドル、それもなければチャンネル ID
 */
export function channelDisplayName(channel: Channel): string {
  if (channel.name) return channel.name;
  for (const site of SITES) {
    const handle = channel.accounts[site]?.handle;
    if (handle) return formatHandle(site, handle);
  }
  for (const site of SITES) {
    const id = channel.accounts[site]?.siteChannelId;
    if (id) return id;
  }
  return '';
}

/** チャンネルを整理するためのグループ（フォルダ）。フレーズは持たない */
export interface Group {
  id: string;
  name: string;
  /** Channel.id を並べる。配列の順番がグループの中での並び順 */
  channelIds: string[];
}

/**
 * 保存するデータ全体
 *
 * 守るべきこと（型では表せないので、保存するときにチェックする）
 * - どのチャンネルも、groups[].channelIds と ungroupedChannelIds のどこか 1 か所だけに入っている
 * - 同じハンドルや YouTube のチャンネル ID が、2 つのチャンネルに登録されていない
 */
export interface PhraseData {
  schemaVersion: typeof SCHEMA_VERSION;
  /** 全チャンネル共通のフレーズ */
  globalPhrases: Phrase[];
  /** 配列の順番がグループの並び順 */
  groups: Group[];
  /** どのグループにも入っていないチャンネルの並び順 */
  ungroupedChannelIds: string[];
  /** Channel.id から引けるようにしたチャンネル */
  channels: Record<string, Channel>;
}

/** 空のデータを作る（初めてインストールしたときの初期値。個人用のデータは入れない） */
export function createEmptyData(): PhraseData {
  return {
    schemaVersion: SCHEMA_VERSION,
    globalPhrases: [],
    groups: [],
    ungroupedChannelIds: [],
    channels: {},
  };
}

const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 10;

/**
 * 短いランダムな id を作る（36 種類の文字 × 10 文字）
 * storage.sync の容量を節約するため、crypto.randomUUID()（36 文字）より短くしている
 */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  let id = '';
  for (const b of bytes) id += ID_CHARS[b % ID_CHARS.length];
  return id;
}
