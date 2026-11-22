/**
 * 設定の保存と読み込み（storage.sync の 'settings' キー）
 *
 * フレーズのデータ（meta / global / ch:<id>）とは別のキーに置き、エクスポートには含めない
 * 変更はすぐに保存する（編集画面の保存ボタンは使わない）
 */
export interface Settings {
  /**
   * 有効にした mod の id（メニューにボタンを出す）
   * 初期値は空 = どの mod も無効（初めて使う人のメニューをすっきりさせるため）。新しく足した mod も最初は無効
   */
  enabledMods: string[];
  /**
   * メニューの + の入力欄で、Enter を押したら追加する（変換中の Enter は除く）
   * 誤って追加しないように、初期値はオフ（✓ ボタンだけで追加する）
   */
  submitOnEnter: boolean;
  /**
   * 登録していないチャンネル（チャンネルが分からないときも含む）では、メニューを出さない
   * 初期値はオフ（初めて使う人が「未登録」から登録する流れに気づけるように）
   */
  hideUnregistered: boolean;
}

const KEY = 'settings';

export function defaultSettings(): Settings {
  return { enabledMods: [], submitOnEnter: false, hideUnregistered: false };
}

/** 読めないときや、形が違うときは初期値にする（項目ごとに） */
function parseSettings(value: unknown): Settings {
  const v = value as Partial<Settings> | undefined;
  return {
    enabledMods: Array.isArray(v?.enabledMods) ? v.enabledMods.filter((x): x is string => typeof x === 'string') : [],
    submitOnEnter: v?.submitOnEnter === true,
    hideUnregistered: v?.hideUnregistered === true,
  };
}

export async function loadSettings(): Promise<Settings> {
  try {
    return parseSettings((await browser.storage.sync.get(KEY))[KEY]);
  } catch {
    return defaultSettings();
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.sync.set({ [KEY]: settings });
}

/**
 * 設定が変わったら（編集画面や別の PC で）callback を呼ぶ
 * @returns 監視をやめる関数
 */
export function watchSettings(callback: (settings: Settings) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
    if (areaName === 'sync' && KEY in changes) callback(parseSettings(changes[KEY]?.newValue));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
