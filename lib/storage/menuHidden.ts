/**
 * メニューを隠しているかどうか（storage.local の 'menuHidden'）
 *
 * ツールバーの拡張機能アイコンを押すと切り替わる（background が保存する）
 * すべての YouTube のタブに効き、読み込み直しても続く。PC ごとの状態なので local に置く
 */
const KEY = 'menuHidden';

export async function loadMenuHidden(): Promise<boolean> {
  try {
    return (await browser.storage.local.get(KEY))[KEY] === true;
  } catch {
    return false;
  }
}

export async function saveMenuHidden(hidden: boolean): Promise<void> {
  await browser.storage.local.set({ [KEY]: hidden });
}

/**
 * 変わったら callback を呼ぶ
 * @returns 監視をやめる関数
 */
export function watchMenuHidden(callback: (hidden: boolean) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
    if (areaName === 'local' && KEY in changes) callback(changes[KEY]?.newValue === true);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
