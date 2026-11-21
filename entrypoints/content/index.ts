/**
 * YouTube 上で動く content script
 *
 * YouTube は SPA なので、トップページなどから動画に移動しても読み込み直されない。
 * そのため youtube.com のすべてのページで動かし、メニューを出すかどうかは URL を見て決める
 */
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { NewerSchemaVersionError, loadData, watchData } from '../../lib/storage/sync';
import { createMenu, type MenuState } from './menu';
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

    const ui = await createShadowRootUi(ctx, {
      name: 'live-chat-phrases',
      position: 'inline',
      anchor: 'body',
      css: styleText,
      // メニューの中のキー操作が YouTube のショートカットに届かないようにする
      isolateEvents: true,
      onMount: (container) => createMenu(container),
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
          console.warn('[LiveChatPhrases] データを読めませんでした', e);
        })
        .finally(refresh);

    await applyLoaded(loadData());
    // 編集画面や別の PC でデータが変わったら、メニューに反映する
    const stopWatching = watchData((d) => void applyLoaded(Promise.resolve(d)));
    ctx.onInvalidated(stopWatching);

    watchPage(ctx, refresh);
  },
});
