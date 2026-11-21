/**
 * フローティングメニュー（Shadow DOM の中に作る）
 *
 * - 画面に常に出すアイコン。ドラッグで動かせる。クリックでメニューを開く / 閉じる
 * - メニューには「共通 → チャンネル」の順にフレーズのボタンを並べる。クリックでクリップボードにコピーする
 */
import { findChannel, type PageChannel } from '../../lib/model/match';
import type { Phrase, PhraseData } from '../../lib/model/types';
import { copyText } from './clipboard';
import { loadPosition, savePosition, type IconPosition } from './position';

export interface MenuState {
  /** アイコンを出すページか */
  visible: boolean;
  /** 見ている動画のチャンネル（分からなければ null） */
  page: PageChannel | null;
  /** 読めなかったときは null */
  data: PhraseData | null;
  /** データを読めなかった理由 */
  loadError?: 'newerSchemaVersion' | 'loadFailed';
}

const ICON_SIZE = 40;
const MARGIN = 8;
const DRAG_THRESHOLD = 4;
const FLASH_MS = 600;

// public/_locales/{en,ja}/messages.json から文言を引く
function t(key: string): string {
  return browser.i18n.getMessage(key as never) || key;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** 吹き出しのアイコン（外部の画像は使わない） */
function iconSvg(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 6v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2z');
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  return svg;
}

export function createMenu(container: HTMLElement): { update(state: MenuState): void } {
  const root = el('div', 'lcp');
  const icon = el('button', 'lcp-icon');
  icon.type = 'button';
  icon.setAttribute('aria-label', t('openMenu'));
  icon.title = t('openMenu');
  icon.appendChild(iconSvg());
  const panel = el('div', 'lcp-panel');
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  root.append(icon, panel);
  container.appendChild(root);

  let state: MenuState = { visible: false, page: null, data: null };
  let renderedKey = '';
  let position: IconPosition = { right: 24, bottom: 96 };

  // ---------------------------------------------------------------------------
  // 位置
  // ---------------------------------------------------------------------------

  const clamp = (p: IconPosition): IconPosition => ({
    right: Math.min(Math.max(p.right, MARGIN), Math.max(MARGIN, window.innerWidth - ICON_SIZE - MARGIN)),
    bottom: Math.min(Math.max(p.bottom, MARGIN), Math.max(MARGIN, window.innerHeight - ICON_SIZE - MARGIN)),
  });

  const applyPosition = () => {
    const p = clamp(position);
    icon.style.right = `${p.right}px`;
    icon.style.bottom = `${p.bottom}px`;
    if (!panel.hidden) placePanel();
  };

  /** メニューをアイコンの近くに出す。画面の中央より下なら上に、右なら左に向かって開く */
  const placePanel = () => {
    const r = icon.getBoundingClientRect();
    const s = panel.style;
    s.top = s.bottom = s.left = s.right = '';
    if (r.top + r.height / 2 > window.innerHeight / 2) s.bottom = `${window.innerHeight - r.top + MARGIN}px`;
    else s.top = `${r.bottom + MARGIN}px`;
    if (r.left + r.width / 2 > window.innerWidth / 2) s.right = `${window.innerWidth - r.right}px`;
    else s.left = `${r.left}px`;
  };

  void loadPosition().then((p) => {
    position = p;
    applyPosition();
  });
  window.addEventListener('resize', applyPosition);

  // ---------------------------------------------------------------------------
  // ドラッグとクリック
  // ---------------------------------------------------------------------------

  let drag: { x: number; y: number; start: IconPosition; moved: boolean } | null = null;

  icon.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    icon.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, start: clamp(position), moved: false };
  });
  icon.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    position = clamp({ right: drag.start.right - dx, bottom: drag.start.bottom - dy });
    applyPosition();
  });
  icon.addEventListener('pointerup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (moved) void savePosition(position);
    else setOpen(panel.hidden);
  });
  icon.addEventListener('pointercancel', () => {
    drag = null;
  });

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    icon.setAttribute('aria-expanded', String(open));
    if (open) {
      render(true);
      placePanel();
    }
  };

  // メニューの外をクリックしたとき、Esc を押したときに閉じる
  document.addEventListener('pointerdown', (e) => {
    if (!panel.hidden && !e.composedPath().includes(root)) setOpen(false);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) setOpen(false);
  });

  // ---------------------------------------------------------------------------
  // 中身
  // ---------------------------------------------------------------------------

  const phraseButton = (phrase: Phrase) => {
    const button = el('button', 'lcp-phrase', phrase.label ?? phrase.text);
    button.type = 'button';
    button.title = phrase.text;
    button.addEventListener('click', async () => {
      const ok = await copyText(phrase.text, root);
      button.classList.remove('lcp-copied', 'lcp-failed');
      button.classList.add(ok ? 'lcp-copied' : 'lcp-failed');
      status.textContent = ok ? t('copied') : t('copyFailed');
      setTimeout(() => button.classList.remove('lcp-copied', 'lcp-failed'), FLASH_MS);
    });
    return button;
  };

  const section = (title: string, phrases: Phrase[]) => {
    const s = el('section', 'lcp-section');
    const list = el('div', 'lcp-phrases');
    list.append(...phrases.map(phraseButton));
    s.append(el('h3', 'lcp-section-title', title), list);
    return s;
  };

  const status = el('div', 'lcp-status');
  status.setAttribute('aria-live', 'polite');

  /** メニューの中身を作り直す。中身が変わっていなければ何もしない（コピーした表示が消えないように） */
  const render = (force = false) => {
    const key = JSON.stringify([state.page, state.data, state.loadError]);
    if (!force && key === renderedKey) return;
    renderedKey = key;

    const { page, data, loadError } = state;
    const header = el('div', 'lcp-header');
    const channel = data && page ? findChannel(data, page) : undefined;
    if (channel) {
      header.append(el('span', 'lcp-channel', channel.name));
    } else if (page) {
      header.append(
        el('span', 'lcp-channel', page.handle ? `@${page.handle}` : (page.youtubeChannelId ?? '')),
        el('span', 'lcp-badge', t('notRegistered')),
      );
    } else {
      header.append(el('span', 'lcp-channel lcp-muted', t('channelUnknown')));
    }

    const body: HTMLElement[] = [];
    if (loadError) {
      body.push(el('p', 'lcp-message', t(loadError === 'newerSchemaVersion' ? 'errorNewerVersion' : 'errorLoadFailed')));
    } else if (data) {
      if (data.globalPhrases.length > 0) body.push(section(t('sectionGlobal'), data.globalPhrases));
      if (channel && channel.phrases.length > 0) body.push(section(t('sectionChannel'), channel.phrases));
      if (body.length === 0) body.push(el('p', 'lcp-message', t('noPhrases')));
    }

    status.textContent = '';
    panel.replaceChildren(header, ...body, status);
  };

  return {
    update(next: MenuState) {
      state = next;
      // YouTube のダークテーマに合わせる（<html dark> が付く）
      root.classList.toggle('lcp-dark', document.documentElement.hasAttribute('dark'));
      root.hidden = !state.visible;
      if (!state.visible) setOpen(false);
      else if (!panel.hidden) render();
      else renderedKey = '';
    },
  };
}
