/**
 * メニューの位置と、開いているかどうかの保存（storage.local）
 *
 * 画面の大きさは PC ごとに違うので、sync ではなく local に保存する
 * 位置は、閉じたときのアイコンの、画面の右下からの距離で持つ
 * （ウィンドウの大きさを変えても右下に付いてくるように）
 */
export interface WidgetState {
  right: number;
  bottom: number;
  open: boolean;
}

const KEY = 'menuWidget';
export const DEFAULT_WIDGET: WidgetState = { right: 24, bottom: 96, open: false };

export async function loadWidgetState(): Promise<WidgetState> {
  try {
    const value = (await browser.storage.local.get(KEY))[KEY] as Partial<WidgetState> | undefined;
    if (typeof value?.right === 'number' && typeof value.bottom === 'number') {
      return { right: value.right, bottom: value.bottom, open: value.open === true };
    }
  } catch {
    // 読めなければ初期値にする
  }
  return { ...DEFAULT_WIDGET };
}

export async function saveWidgetState(state: WidgetState): Promise<void> {
  try {
    await browser.storage.local.set({ [KEY]: state });
  } catch {
    // 保存できなくても困らないので無視する
  }
}
