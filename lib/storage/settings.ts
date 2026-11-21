/**
 * 設定の保存と読み込み（storage.sync の 'settings' キー）
 *
 * フレーズのデータ（meta / global / ch:<id>）とは別のキーに置き、エクスポートには含めない
 * 変更はすぐに保存する（編集画面の保存ボタンは使わない）
 */
export interface Settings {
  /**
   * 無効にした mod の id（メニューにボタンを出さない）
   * 「有効にしたもの」ではなく「無効にしたもの」を持つので、新しく足した mod は最初から有効になる
   */
  disabledMods: string[];
}

const KEY = 'settings';

export function defaultSettings(): Settings {
  return { disabledMods: [] };
}

/** 読めないときや、形が違うときは初期値にする */
function parseSettings(value: unknown): Settings {
  const v = value as Partial<Settings> | undefined;
  return {
    disabledMods: Array.isArray(v?.disabledMods) ? v.disabledMods.filter((x): x is string => typeof x === 'string') : [],
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
