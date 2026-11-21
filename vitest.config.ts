import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// WxtVitest: browser を偽物（メモリ上で動く fake-browser）に差し替え、WXT の自動 import を使えるようにする
export default defineConfig({
  plugins: [WxtVitest()],
});
