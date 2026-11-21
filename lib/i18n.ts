/**
 * public/_locales/{en,ja}/messages.json から文言を引く
 * 見つからなければキーをそのまま返す（画面が空にならないように）
 * substitutions は messages.json の placeholders（$1, $2 …）に入る
 */
export function t(key: string, ...substitutions: string[]): string {
  try {
    return browser.i18n.getMessage(key as never, substitutions) || key;
  } catch {
    return key;
  }
}
