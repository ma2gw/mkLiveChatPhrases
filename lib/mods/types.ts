/**
 * mod: コピーする文字列を受け取り、変更を施して返すもの
 *
 * メニューのコピーボタンの並びの下に、mod ごとの切り替えボタンが並ぶ
 * オンになっている mod を、一覧（index.ts の MODS）の順にかけてからコピーする
 */
export interface Mod {
  /** 一意の名前 */
  id: string;
  /** ボタンに表示する短い文字 */
  label: string;
  /** ツールチップと読み上げに使う文言のキー（public/_locales の messages.json） */
  messageKey: string;
  /** 同じ group の mod は、どれか 1 つだけオンにできる（例: ×2 と ×3） */
  group?: string;
  /** true なら、1 回コピーしたら自動でオフに戻る（コピーに失敗したときはオンのまま） */
  once?: boolean;
  /** コピーする文字列を受け取り、変更したものを返す */
  apply(text: string): string;
}
