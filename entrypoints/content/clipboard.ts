/**
 * クリップボードへのコピー
 *
 * navigator.clipboard.writeText は、ページにフォーカスがないときなどに失敗する。
 * そのときは古い方法（textarea を選択して execCommand('copy')）を試し、
 * それでも駄目なら false を返す（呼ぶ側で「コピーできませんでした」と表示する）
 */
export async function copyText(text: string, container: HTMLElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyWithExecCommand(text, container);
  }
}

function copyWithExecCommand(text: string, container: HTMLElement): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  Object.assign(textarea.style, { position: 'fixed', top: '0', left: '0', opacity: '0', pointerEvents: 'none' });
  container.appendChild(textarea);
  try {
    textarea.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
