/**
 * アイコンの位置の保存（storage.local）
 *
 * 画面の大きさは PC ごとに違うので、sync ではなく local に保存する
 * 画面の右下からの距離で持つ（ウィンドウの大きさを変えても右下に付いてくるように）
 */
export interface IconPosition {
  right: number;
  bottom: number;
}

const KEY = 'menuIconPosition';
export const DEFAULT_POSITION: IconPosition = { right: 24, bottom: 96 };

export async function loadPosition(): Promise<IconPosition> {
  try {
    const value = (await browser.storage.local.get(KEY))[KEY] as Partial<IconPosition> | undefined;
    if (typeof value?.right === 'number' && typeof value.bottom === 'number') {
      return { right: value.right, bottom: value.bottom };
    }
  } catch {
    // 読めなければ初期位置にする
  }
  return { ...DEFAULT_POSITION };
}

export async function savePosition(position: IconPosition): Promise<void> {
  try {
    await browser.storage.local.set({ [KEY]: position });
  } catch {
    // 位置を保存できなくても困らないので無視する
  }
}
