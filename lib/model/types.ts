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

/** 定型文を登録するチャンネル */
export interface Channel {
  id: string;
  /** 編集画面で表示する名前 */
  name: string;
  /**
   * 見ているページがこのチャンネルかどうかを判定するためのハンドル（複数の別名を持てる）
   * '@' を外し、decodeURIComponent したものを保存する。比べるときは大文字と小文字を区別しない
   */
  handles: string[];
  /** YouTube のチャンネル ID（'UC...'）。ハンドルが変わっても判定できるように持つ */
  youtubeChannelIds: string[];
  /** 配列の順番がメニューでの並び順 */
  phrases: Phrase[];
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
