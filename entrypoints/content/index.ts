/**
 * YouTube 上で動く content script
 *
 * YouTube は SPA なので、トップページなどから動画に移動しても読み込み直されない。
 * そのため youtube.com のすべてのページで動かし、メニューを出すかどうかは URL を見て決める
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

    const handlers: MenuHandlers = {
      async onAddPhrase(text) {
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
        // content script からはタブを開けないので、background に頼む
        const page = getPageChannel();
        const channelId = data && page ? findChannel(data, page)?.id : undefined;
        browser.runtime.sendMessage({ type: 'openEditor', channelId }).catch((e: unknown) => {
          console.warn('[MkLiveChatPhrases] 編集画面を開けませんでした', e);
        });
      },
      onRegisterChannel() {
        const page = getPageChannel();
        if (!page) return;
        browser.runtime.sendMessage({ type: 'openEditor', newChannel: page }).catch((e: unknown) => {
          console.warn('[MkLiveChatPhrases] 編集画面を開けませんでした', e);
        });
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

    const refresh = () => {
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
    const stopWatching = watchData((d) => void applyLoaded(Promise.resolve(d)));
    ctx.onInvalidated(stopWatching);

    // 設定（無効にした mod）を反映し、編集画面や別の PC で変わったら反映し直す
    void loadSettings().then((s) => menu.setDisabledMods(s.disabledMods));
    ctx.onInvalidated(watchSettings((s) => menu.setDisabledMods(s.disabledMods)));

    watchPage(ctx, refresh);
  },
});
