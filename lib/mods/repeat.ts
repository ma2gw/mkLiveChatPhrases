import type { Mod } from './types';

/** ×n: n 回つなげる。repeat の group の中でどれか 1 つだけオンにできる */
function repeatMod(n: number, messageKey: string): Mod {
  return {
    id: `repeat${n}`,
    label: `×${n}`,
    messageKey,
    group: 'repeat',
    apply: (text) => text.repeat(n),
  };
}

export const repeat2Mod = repeatMod(2, 'repeat2');
export const repeat3Mod = repeatMod(3, 'repeat3');
