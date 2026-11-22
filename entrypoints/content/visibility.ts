/**
 * メニューを出すかどうか（サイトによらない）
 * - 出すページ（YouTube の /watch や /live/、Twitch のチャンネルのページ）でなければ出さない
 * - ツールバーのアイコンで隠していれば出さない
 * - 設定「未登録のチャンネルでは出さない」がオンなら、登録していないチャンネル（分からないときも含む）では出さない
 */
export function shouldShowMenu(o: {
  targetPage: boolean;
  hidden: boolean;
  hideUnregistered: boolean;
  registered: boolean;
}): boolean {
  if (!o.targetPage || o.hidden) return false;
  return !o.hideUnregistered || o.registered;
}
