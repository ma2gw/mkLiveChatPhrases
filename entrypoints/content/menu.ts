/**
 * フローティングメニュー（Shadow DOM の中に作る）
 *
 * アイコンとメニューは 1 つの部品（root）で、閉じているときはアイコン、開くとメニューになる
 * - アイコンを押すと、アイコンがあった場所を基準にメニューが広がる
 *   （アイコンが画面の右寄りなら左へ、下寄りなら上へ広がる）
 * - 格納ボタンでアイコンに戻る。アイコンは格納ボタンがあった場所に出す
 * - 開いていても閉じていても、全体をドラッグで動かせる（フレーズと格納ボタンはクリックを優先）
 * - 位置と開閉の状態は保存し、読み込み直しても同じ状態で表示する
 * - フレーズは「共通 → チャンネル」の順に並べ、クリックでクリップボードにコピーする
 * - 並びの最後の + で、このチャンネルにフレーズを追加できる（ラベルなし。未登録ならチャンネルも登録する）
 */
import { findChannel, type PageChannel } from '../../lib/model/match';
import { channelDisplayName, formatHandle, type Phrase, type PhraseData } from '../../lib/model/types';
import { t } from '../../lib/i18n';
import { textColorFor } from '../../lib/color';
import type { Appearance, Settings } from '../../lib/storage/settings';
import { copyText } from './clipboard';
import { DEFAULT_WIDGET, loadWidgetState, saveWidgetState, type WidgetState } from './widgetState';

export interface MenuState {
  /** メニューを出すページか */
  visible: boolean;
  /** 見ている動画のチャンネル（分からなければ null） */
  page: PageChannel | null;
  /** 読めなかったときは null */
  data: PhraseData | null;
  /** データを読めなかった理由 */
  loadError?: 'newerSchemaVersion' | 'loadFailed';
  /** サイトがダークテーマか（メニューの色を自動にしているときに合わせる） */
  dark?: boolean;
}

export interface MenuHandlers {
  /** + から入力された文字列を、見ているチャンネルに追加して保存する。保存できたら true */
  onAddPhrase(text: string): Promise<boolean>;
  /** 編集画面を開く（見ているチャンネルが登録済みなら、それを選んだ状態で） */
  onOpenEditor(): void;
  /** 「未登録」を押したとき。見ているチャンネルのハンドルと ID を入れた状態で、登録の画面を開く */
  onRegisterChannel(): void;
}

/** メニューが広がる向き */
interface Direction {
  h: 'left' | 'right';
  v: 'up' | 'down';
}

const ICON_SIZE = 40;
const MARGIN = 8;
const DRAG_THRESHOLD = 4;
const FLASH_MS = 600;
/** ドラッグを始めない要素（クリックを優先する） */
const NO_DRAG = '.lcp-phrase, .lcp-collapse, .lcp-badge, .lcp-add, .lcp-add-form';


function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** 外部の画像は使わず、SVG をその場で作る */
function svgIcon(d: string): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  return svg;
}
/** 吹き出し */
const ICON_CHAT = 'M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 6v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2z';
/** 格納（横棒） */
const ICON_COLLAPSE = 'M5 11h14v2H5z';
/** 編集（鉛筆） */
const ICON_EDIT = 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z';

export interface Menu {
  update(state: MenuState): void;
  applySettings(settings: Settings): void;
}

export function createMenu(container: HTMLElement, handlers: MenuHandlers): Menu {
  // ---------------------------------------------------------------------------
  // 要素
  // ---------------------------------------------------------------------------

  const root = el('div', 'lcp');
  root.hidden = true; // 保存した位置を読むまでは出さない

  const icon = el('button', 'lcp-icon');
  icon.type = 'button';
  icon.setAttribute('aria-label', t('openMenu'));
  icon.title = t('openMenu');
  icon.appendChild(svgIcon(ICON_CHAT));

  const panel = el('div', 'lcp-panel');
  panel.setAttribute('role', 'dialog');
  const header = el('div', 'lcp-header');
  const channelArea = el('div', 'lcp-channel-area');
  const collapse = el('button', 'lcp-collapse');
  collapse.type = 'button';
  collapse.setAttribute('aria-label', t('collapseMenu'));
  collapse.title = t('collapseMenu');
  collapse.appendChild(svgIcon(ICON_COLLAPSE));
  const edit = el('button', 'lcp-collapse');
  edit.type = 'button';
  edit.setAttribute('aria-label', t('openEditor'));
  edit.title = t('openEditor');
  edit.appendChild(svgIcon(ICON_EDIT));
  edit.addEventListener('click', () => handlers.onOpenEditor());
  header.append(channelArea, edit, collapse);
  const body = el('div', 'lcp-body');

  const status = el('div', 'lcp-status');
  status.setAttribute('aria-live', 'polite');
  panel.append(header, body, status);

  root.append(icon, panel);
  container.appendChild(root);

  let state: MenuState = { visible: false, page: null, data: null };
  let widget: WidgetState = { ...DEFAULT_WIDGET };
  let loaded = false;
  let dir: Direction = { h: 'left', v: 'up' };
  let renderedKey = '';

  // ---------------------------------------------------------------------------
  // 位置
  // ---------------------------------------------------------------------------

  /** アイコンの位置から、メニューが広がる向きを決める（画面の広いほうへ） */
  const directionFromIcon = (): Direction => {
    const centerX = window.innerWidth - widget.right - ICON_SIZE / 2;
    const centerY = window.innerHeight - widget.bottom - ICON_SIZE / 2;
    return {
      h: centerX > window.innerWidth / 2 ? 'left' : 'right',
      v: centerY > window.innerHeight / 2 ? 'up' : 'down',
    };
  };

  /** widget の位置と開閉の状態を、画面に反映する */
  const layout = () => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const s = root.style;
    s.left = s.right = s.top = s.bottom = '';
    icon.hidden = widget.open;
    panel.hidden = !widget.open;

    if (!widget.open) {
      s.right = `${widget.right}px`;
      s.bottom = `${widget.bottom}px`;
      return;
    }
    // アイコンの角を基準に広げる
    if (dir.h === 'left') s.right = `${widget.right}px`;
    else s.left = `${W - widget.right - ICON_SIZE}px`;
    if (dir.v === 'up') s.bottom = `${widget.bottom}px`;
    else s.top = `${H - widget.bottom - ICON_SIZE}px`;
    // 広がる向きに使える広さまでにする
    const spaceH = dir.h === 'left' ? W - widget.right - MARGIN : widget.right + ICON_SIZE - MARGIN;
    const spaceV = dir.v === 'up' ? H - widget.bottom - MARGIN : widget.bottom + ICON_SIZE - MARGIN;
    panel.style.maxWidth = `${Math.max(ICON_SIZE, spaceH)}px`;
    panel.style.maxHeight = `${Math.max(ICON_SIZE, Math.min(H * 0.6, spaceV))}px`;
  };

  /** 画面からはみ出していたら、はみ出した分だけ戻す */
  const fitInViewport = () => {
    // 隠れているときは大きさが 0 になり、正しく測れない
    if (root.hidden) return;
    const r = root.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (r.right > window.innerWidth - MARGIN) dx = r.right - (window.innerWidth - MARGIN);
    if (r.left - dx < MARGIN) dx = r.left - MARGIN;
    if (r.bottom > window.innerHeight - MARGIN) dy = r.bottom - (window.innerHeight - MARGIN);
    if (r.top - dy < MARGIN) dy = r.top - MARGIN;
    if (dx === 0 && dy === 0) return;
    widget.right += dx;
    widget.bottom += dy;
    layout();
  };

  const place = () => {
    layout();
    fitInViewport();
  };

  const setOpen = (open: boolean) => {
    if (widget.open === open) return;
    if (open) dir = directionFromIcon();
    widget.open = open;
    icon.setAttribute('aria-expanded', String(open));
    if (open) render(true);
    place();
    void saveWidgetState(widget);
  };

  void loadWidgetState().then((saved) => {
    widget = saved;
    dir = directionFromIcon();
    loaded = true;
    if (widget.open) render(true);
    applyVisibility();
    place();
  });
  window.addEventListener('resize', place);

  // ---------------------------------------------------------------------------
  // ドラッグとクリック
  // ---------------------------------------------------------------------------

  let drag: { x: number; y: number; right: number; bottom: number; moved: boolean } | null = null;

  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest(NO_DRAG)) return;
    // 拡張機能を読み込み直したあとなどで、メニューがもうページから外れていたら何もしない
    // （外れた要素への setPointerCapture は InvalidStateError になる）
    if (!root.isConnected) return;
    try {
      root.setPointerCapture(e.pointerId);
    } catch {
      // ポインターがもう押されていないときなども失敗する。つかまえられなくても、ドラッグはできる
    }
    drag = { x: e.clientX, y: e.clientY, right: widget.right, bottom: widget.bottom, moved: false };
  });
  root.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    root.classList.add('lcp-dragging');
    widget.right = drag.right - dx;
    widget.bottom = drag.bottom - dy;
    place();
  });
  const endDrag = (clicked: boolean) => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    root.classList.remove('lcp-dragging');
    if (moved) void saveWidgetState(widget);
    else if (clicked && !widget.open) setOpen(true);
  };
  root.addEventListener('pointerup', () => endDrag(true));
  root.addEventListener('pointercancel', () => endDrag(false));

  // キーボード（Enter / Space）で押されたとき。マウスのときは pointerup で開いている
  icon.addEventListener('click', (e) => {
    if (e.detail === 0) setOpen(true);
  });
  collapse.addEventListener('click', () => {
    // 格納したアイコンは、格納ボタンがあった場所に出す（中心を合わせる）
    const r = collapse.getBoundingClientRect();
    widget.right = window.innerWidth - (r.left + r.width / 2) - ICON_SIZE / 2;
    widget.bottom = window.innerHeight - (r.top + r.height / 2) - ICON_SIZE / 2;
    setOpen(false);
    icon.focus();
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
      // うまくいったときはボタンの色だけで知らせる。失敗したときは、どうすればよいかを出す
      status.textContent = ok ? '' : t('copyFailed');
      setTimeout(() => button.classList.remove('lcp-copied', 'lcp-failed'), FLASH_MS);
    });
    return button;
  };

  // ---------------------------------------------------------------------------
  // + でフレーズを追加する
  // ---------------------------------------------------------------------------

  /** 入力中の文字列。入力欄を出していないときは null */
  let draft: string | null = null;
  /** 設定: Enter で追加するか */
  let submitOnEnter = false;
  /** 入力欄を開いたときのチャンネル。別のチャンネルに移ったら入力をやめる */
  let draftPageKey = '';
  let saving = false;

  const closeAdd = () => {
    draft = null;
    render(true);
  };

  const submitAdd = async (form: HTMLElement, input: HTMLInputElement) => {
    if (saving) return;
    // 何も入力されていなければ（空白だけでも）、何もせずに閉じる
    if (!input.value.trim()) {
      closeAdd();
      return;
    }
    saving = true;
    const controls = form.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button');
    controls.forEach((c) => (c.disabled = true));
    const ok = await handlers.onAddPhrase(input.value);
    saving = false;
    if (ok) {
      closeAdd();
    } else {
      controls.forEach((c) => (c.disabled = false));
      input.focus();
      status.textContent = t('addFailed');
    }
  };

  /** 入力欄の横の小さなボタン（✓ / ×） */
  const formButton = (className: string, text: string, label: string, onClick: () => void) => {
    const button = el('button', className, text);
    button.type = 'button';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.disabled = saving;
    button.addEventListener('click', onClick);
    return button;
  };

  /**
   * フレーズの並びの最後に置く + ボタン
   * 入力中（hidden）も場所は残して見えなくするだけにする（並びの高さが変わってガタつかないように）
   */
  const addButton = (hidden: boolean): HTMLElement => {
    const button = el('button', 'lcp-add', '+');
    button.type = 'button';
    button.title = t('addPhrase');
    button.setAttribute('aria-label', t('addPhrase'));
    if (hidden) {
      button.classList.add('lcp-add-hidden');
      button.tabIndex = -1;
      button.setAttribute('aria-hidden', 'true');
    }
    button.addEventListener('click', () => {
      draft = '';
      draftPageKey = JSON.stringify(state.page);
      render(true);
    });
    return button;
  };

  /** + を押したときの入力欄（✓ で追加、× か Esc でやめる）。フレーズ欄のいちばん下の行に出す */
  const addForm = (): HTMLElement => {
    const form = el('div', 'lcp-add-form');
    const input = el('input', 'lcp-add-input');
    input.type = 'text';
    input.value = draft ?? '';
    input.placeholder = t(submitOnEnter ? 'addPhrasePlaceholderEnter' : 'addPhrasePlaceholder');
    input.setAttribute('aria-label', t('addPhrase'));
    input.disabled = saving;
    input.addEventListener('input', () => {
      draft = input.value;
    });
    // Enter で追加するのは、設定でオンにしたときだけ（誤って追加しないように、初期値はオフ）
    // 日本語の変換を確定する Enter では追加しない
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAdd();
      } else if (e.key === 'Enter' && submitOnEnter && !e.isComposing) {
        e.preventDefault();
        void submitAdd(form, input);
      }
    });
    // 何も入力せずにほかの場所を押したら閉じる（入力途中の文字は消さない。✓ / × に移るときは閉じない）
    input.addEventListener('blur', (e) => {
      if (e.relatedTarget instanceof Node && form.contains(e.relatedTarget)) return;
      if (input.isConnected && !saving && !input.value.trim()) closeAdd();
    });
    const confirm = formButton('lcp-add-confirm', '✓', t('addConfirm'), () => void submitAdd(form, input));
    const cancel = formButton('lcp-add-cancel', '×', t('addCancel'), closeAdd);
    form.append(input, confirm, cancel);
    // 作り直したあとも入力を続けられるようにする
    queueMicrotask(() => input.focus());
    return form;
  };

  /** 「未登録」のバッジ。押すと、このチャンネルを登録する画面を開く */
  const registerBadge = () => {
    const badge = el('button', 'lcp-badge', t('notRegistered'));
    badge.type = 'button';
    badge.title = t('registerChannel');
    badge.addEventListener('click', () => handlers.onRegisterChannel());
    return badge;
  };

  /** メニューの中身を作り直す。中身が変わっていなければ何もしない（コピーした表示が消えないように） */
  const render = (force = false) => {
    const key = JSON.stringify([state.page, state.data, state.loadError]);
    if (!force && key === renderedKey) return;
    renderedKey = key;

    const { page, data, loadError } = state;
    // 別のチャンネルの動画に移ったら、入力途中のものは捨てる（違うチャンネルに追加しないように）
    if (draft !== null && JSON.stringify(page) !== draftPageKey) draft = null;
    const channel = data && page ? findChannel(data, page) : undefined;
    if (channel) {
      channelArea.replaceChildren(el('span', 'lcp-channel', channelDisplayName(channel)));
    } else if (page) {
      channelArea.replaceChildren(
        el('span', 'lcp-channel', page.handle ? formatHandle(page.site, page.handle) : (page.siteChannelId ?? '')),
        registerBadge(),
      );
    } else {
      channelArea.replaceChildren(el('span', 'lcp-channel lcp-muted', t('channelUnknown')));
    }

    if (loadError) {
      body.replaceChildren(el('p', 'lcp-message', t(loadError === 'newerSchemaVersion' ? 'errorNewerVersion' : 'errorLoadFailed')));
    } else if (data) {
      // 見出しは付けず、共通 → チャンネルの順に並べるだけ
      const phrases = [...data.globalPhrases, ...(channel?.phrases ?? [])];
      const children: HTMLElement[] = [];
      const adding = page !== null && draft !== null;
      if (phrases.length === 0 && !page) {
        // チャンネルが分からず、追加もできないとき
        children.push(el('p', 'lcp-message', t('noPhrases')));
      } else {
        const list = el('div', 'lcp-phrases');
        // フレーズがないときは、その旨をフレーズと同じ並びに置き、横に + を並べる
        if (phrases.length === 0) list.append(el('span', 'lcp-message lcp-empty', t('noPhrases')));
        list.append(...phrases.map(phraseButton));
        // + は並びの最後に置く。入力中は、入力欄をフレーズ欄のいちばん下の行に出す（下合わせ）
        if (page) list.append(addButton(adding));
        children.push(list);
      }
      if (adding) children.push(addForm());
      body.classList.toggle('lcp-adding', adding);
      body.replaceChildren(...children);
    } else {
      body.replaceChildren();
    }
    status.textContent = '';
    // 中身の大きさが変わると、はみ出すことがある
    if (widget.open) place();
  };

  /**
   * 設定の見た目を、CSS の変数として root に入れる（style.css の .lcp の説明を参照）
   * 省略された色は変数を消し、style.css の値（テーマの色や初期値）を使う
   * 文字の色は、背景の明るさから白か黒を選ぶ
   */
  const applyAppearance = (a: Appearance) => {
    const set = (name: string, value: string | undefined) => {
      if (value) root.style.setProperty(name, value);
      else root.style.removeProperty(name);
    };
    root.classList.toggle('lcp-custom', !!a.menuColor);
    set('--lcp-base', a.menuColor);
    set('--lcp-fg', a.menuColor && textColorFor(a.menuColor));
    set('--lcp-border', a.borderColor);
    set('--lcp-icon-bg', a.iconColor);
    set('--lcp-icon-fg', a.iconColor && textColorFor(a.iconColor));
    set('--lcp-alpha', `${a.opacity}%`);
  };

  const applyVisibility = () => {
    root.hidden = !loaded || !state.visible;
  };

  return {
    update(next: MenuState) {
      state = next;
      // サイトのダークテーマに合わせる（判定はサイトのアダプター）
      root.classList.toggle('lcp-dark', !!state.dark);
      // hidden は新しい型定義では 'until-found' も取りうるので、真偽値にそろえる
      const wasHidden = root.hidden !== false;
      applyVisibility();
      if (widget.open) render(wasHidden);
      if (wasHidden && !root.hidden) place();
    },
    /** 設定（見た目、Enter で追加するか）を反映する */
    applySettings(settings: Settings) {
      applyAppearance(settings.appearance);
      if (submitOnEnter !== settings.submitOnEnter) {
        submitOnEnter = settings.submitOnEnter;
        // 入力欄の案内の文を変えるために作り直す
        if (draft !== null) render(true);
      }
      // 行が増えたり減ったりして、はみ出すことがある
      if (widget.open) place();
    },
  };
}
