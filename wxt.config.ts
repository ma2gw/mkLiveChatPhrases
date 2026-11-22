import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'wxt';

/**
 * 普段使いのビルド（npm run install:local）のときだけ、manifest に key を入れて拡張機能の ID を固定する
 * （どの PC でも同じ ID になり、storage.sync が同期される。ストアに出すビルドには入れない）
 */
const localKey =
  process.env.MK_LOCAL_BUILD === '1' && existsSync('local-build-key.txt')
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
    // 権限は最小限にする（ホスト権限は content script の matches から youtube.com だけになる）
    permissions: ['storage'],
    ...(localKey ? { key: localKey } : {}),
  },
  webExt: {
    // npm run dev で起動する Chrome のプロフィールを残す（YouTube にログインしたままにするため）
    // .wxt は .gitignore に入っている
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
  },
});
