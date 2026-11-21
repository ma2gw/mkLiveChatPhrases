import type { Mod } from './types';

/**
 * 末尾にドットを count 個付ける mod を作る
 * 同じ文を続けて送ってスパム扱いされたときに、違う文にして送るために使う
 * ボタンにはドットを count 個並べて表示する
 */
export function dotsMod(count: number): Mod {
  const dots = '.'.repeat(Math.max(1, Math.floor(count)));
  return {
    id: `dots${dots.length}`,
    label: dots,
    messageKey: 'appendDot',
    apply: (text) => `${text}${dots}`,
  };
}
