import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'wxt';

/**
 * 普段使いのビルド（npm run install:local）のときだけ、manifest に key を入れて拡張機能の ID を固定する
 * （どの PC でも同じ ID になり、storage.sync が同期される。ストアに出すビルドには入れない）
 */
const isLocalBuild = process.env.MK_LOCAL_BUILD === '1';
const localKey =
  isLocalBuild && existsSync('local-build-key.txt')
    ? readFileSync('local-build-key.txt', 'utf8').trim()
    : undefined;

// 設定項目: https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  // 編集画面（entrypoints/options）は Svelte で書く。フローティングメニューは vanilla のまま
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    // 名前と説明は public/_locales/*/messages.json から読む
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    // 使っている機能が動く最も古い Chrome（CSS の color-mix() は 111、URLSearchParams.size は 113 から）
    minimum_chrome_version: '113',
    // 権限は最小限にする（ホスト権限は content script の matches から www.youtube.com、www.twitch.tv、twitcasting.tv だけになる）
    permissions: ['storage'],
    // ツールバーのアイコン。ポップアップは出さず、押すとメニューを隠す / 出す（background の action.onClicked）
    action: { default_title: '__MSG_actionHideMenu__' },
    ...(localKey ? { key: localKey } : {}),
  },
  // 普段使いのビルドかどうか（編集画面のバージョンの横に「local」と出す）
  // manifest の key では見分けられない（ストアから入れたものにも key が付くため）
  vite: () => ({
    define: { 'import.meta.env.MK_LOCAL_BUILD': JSON.stringify(isLocalBuild) },
  }),
  hooks: {
    // ストア版と見分けるため、アイコンを差し替える（public の外に置き、ストア用のビルドには入れない）
    // - npm run dev: オレンジ（resources/icon-dev）
    // - npm run install:local: ピンク（resources/icon-local）
    'build:publicAssets': (wxt, files) => {
      const dir = wxt.config.command === 'serve' ? 'resources/icon-dev' : isLocalBuild ? 'resources/icon-local' : null;
      if (!dir) return;
      for (const file of files) {
        const m = file.relativeDest.match(/^icon[/\\](\d+\.png)$/);
        if (m && 'absoluteSrc' in file) file.absoluteSrc = resolve(dir, m[1]!);
      }
    },
  },
  webExt: {
    // npm run dev で起動する Chrome のプロフィールを残す（YouTube にログインしたままにするため）
    // .wxt は .gitignore に入っている
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
  },
});
