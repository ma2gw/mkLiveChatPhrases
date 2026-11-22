/**
 * YouTube 上で動く content script
 *
 * YouTube は SPA なので、トップページなどから動画に移動しても読み込み直されない。
 * そのため youtube.com のすべてのページで動かし、メニューを出すかどうかは URL を見て決める
 *
 * 拡張機能を更新したり読み込み直したりすると、開いていたタブには古い content script が残り、
 * 拡張機能の機能（storage、runtime.sendMessage など）を使うと「Extension context invalidated」になる。
 * そのため、使う前に ctx.isValid で確かめ、無効になっていたらメニューを消して何もしない
 */
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { addPhraseToChannel } from '../../lib/model/edit';
import { findChannel } from '../../lib/model/match';
import { loadSettings, watchSettings } from '../../lib/storage/settings';
import { NewerSchemaVersionError, loadData, saveData, watchData } from '../../lib/storage/sync';
import { createMenu, type MenuHandlers, type MenuState } from './menu';
import styleText from './style.css?inline';
import { getPageChannel, isTargetPage, watchPage } from './youtube';

export default defineContentScript({
  matches: ['*://www.youtube.com/*'],
  // CSS は JS に埋め込み、createShadowRootUi の css で Shadow DOM に入れる
  // （'ui' にすると CSS ファイルを web_accessible_resources で公開する必要があるため）
  cssInjectionMode: 'manual',

  async main(ctx) {
    let data: MenuState['data'] = null;
    let loadError: MenuState['loadError'];

    /** content script の後片付け。無効になったあとは拡張機能の機能が例外を投げるので、握りつぶす */
    const cleanup = (fn: () => void) =>
      ctx.onInvalidated(() => {
        try {
          fn();
        } catch {
          // 無効になったあとなので、何もできない
        }
      });

    /** 編集画面を開くよう background に頼む（content script からはタブを開けないため） */
    const openEditor = (message: object) => {
      if (!ctx.isValid) return;
      try {
        browser.runtime.sendMessage({ type: 'openEditor', ...message }).catch((e: unknown) => {
          console.warn('[MkLiveChatPhrases] 編集画面を開けませんでした', e);
        });
      } catch (e) {
        console.warn('[MkLiveChatPhrases] 編集画面を開けませんでした', e);
      }
    };

    const handlers: MenuHandlers = {
      async onAddPhrase(text) {
        if (!ctx.isValid) return false;
        const page = getPageChannel();
        if (!page) return false;
        try {
          // 別のタブや PC での変更を消さないように、保存されている最新のデータに追加する
          const next = addPhraseToChannel(await loadData(), page, text);
          if (!next) return false;
          const result = await saveData(next);
          if (!result.ok) {
            console.warn('[MkLiveChatPhrases] 追加できませんでした', result.errors);
            return false;
          }
          data = next;
          refresh();
          return true;
        } catch (e) {
          console.warn('[MkLiveChatPhrases] 追加できませんでした', e);
          return false;
        }
      },
      onOpenEditor() {
        const page = getPageChannel();
        const channelId = data && page ? findChannel(data, page)?.id : undefined;
        openEditor({ channelId });
      },
      onRegisterChannel() {
        const page = getPageChannel();
        if (page) openEditor({ newChannel: page });
      },
    };

    const ui = await createShadowRootUi(ctx, {
      name: 'mk-live-chat-phrases',
      position: 'inline',
      anchor: 'body',
      css: styleText,
      // メニューの中のキー操作が YouTube のショートカットに届かないようにする
      isolateEvents: true,
      onMount: (container) => createMenu(container, handlers),
    });
    ui.mount();
    const menu = ui.mounted;
    if (!menu) return;

    // 無効になったら（拡張機能を更新・読み込み直したら）、古いメニューを消す
    cleanup(() => ui.remove());
    // メニューを押したときにも確かめる（isValid は、無効なら onInvalidated を呼ぶ）
    ui.shadowHost.addEventListener('pointerdown', () => void ctx.isValid, { capture: true });

    const refresh = () => {
      if (!ctx.isValid) return;
      const visible = isTargetPage(location);
      menu.update({ visible, page: visible ? getPageChannel() : null, data, loadError });
    };

    const applyLoaded = (result: Promise<MenuState['data']>) =>
      result
        .then((d) => {
          data = d;
          loadError = undefined;
        })
        .catch((e: unknown) => {
          data = null;
          loadError = e instanceof NewerSchemaVersionError ? 'newerSchemaVersion' : 'loadFailed';
          console.warn('[MkLiveChatPhrases] データを読めませんでした', e);
        })
        .finally(refresh);

    await applyLoaded(loadData());
    // 編集画面や別の PC でデータが変わったら、メニューに反映する
    cleanup(watchData((d) => void applyLoaded(Promise.resolve(d))));

    // 設定（有効にした mod、Enter で追加するか）を反映し、編集画面や別の PC で変わったら反映し直す
    void loadSettings().then((s) => menu.applySettings(s));
    cleanup(watchSettings((s) => menu.applySettings(s)));

    watchPage(ctx, refresh);
  },
});
