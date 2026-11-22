/**
 * 色の計算（メニューの見た目のカスタマイズに使う）
 */

/** '#rrggbb' の形か */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

/** '#rrggbb' を [r, g, b]（0〜255）にする */
function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** 相対輝度（WCAG の定義） */
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 2 つの色のコントラスト比（1〜21。大きいほど読みやすい） */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * 背景の色の上に置く文字の色（白か黒の、読みやすいほう）
 * '#rrggbb' でなければ黒にする
 */
export function textColorFor(background: string): '#000000' | '#ffffff' {
  if (!isHexColor(background)) return '#000000';
  return contrastRatio(background, '#ffffff') > contrastRatio(background, '#000000') ? '#ffffff' : '#000000';
}
