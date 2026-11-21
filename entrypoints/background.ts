export default defineBackground(() => {
  // 後で onInstalled でデータの移行（schemaVersion）を行う

  // メニューの「編集」から頼まれたら、編集画面をタブで開く（tabs.create に権限は要らない）
  browser.runtime.onMessage.addListener((message: unknown) => {
    const m = message as { type?: string; channelId?: unknown } | null;
    if (m?.type !== 'openEditor') return;
    const hash = typeof m.channelId === 'string' ? `#channel=${encodeURIComponent(m.channelId)}` : '';
    void browser.tabs.create({ url: browser.runtime.getURL(`/options.html${hash}`) });
  });
});
