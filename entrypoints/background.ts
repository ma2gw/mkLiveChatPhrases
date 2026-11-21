export default defineBackground(() => {
  // 後で onInstalled でデータの移行（schemaVersion）を行う

  // メニューから頼まれたら、編集画面をタブで開く（tabs.create に権限は要らない）
  // - channelId: そのチャンネルを選んだ状態で開く（#channel=<id>）
  // - newChannel: そのハンドルとチャンネル ID を入れたチャンネルを作った状態で開く（#new&handle=…&uc=…）
  browser.runtime.onMessage.addListener((message: unknown) => {
    const m = message as {
      type?: string;
      channelId?: unknown;
      newChannel?: { handle?: unknown; youtubeChannelId?: unknown };
    } | null;
    if (m?.type !== 'openEditor') return;

    const params = new URLSearchParams();
    if (typeof m.channelId === 'string') {
      params.set('channel', m.channelId);
    } else if (m.newChannel) {
      params.set('new', '');
      if (typeof m.newChannel.handle === 'string') params.set('handle', m.newChannel.handle);
      if (typeof m.newChannel.youtubeChannelId === 'string') params.set('uc', m.newChannel.youtubeChannelId);
    }
    const hash = params.size > 0 ? `#${params}` : '';
    void browser.tabs.create({ url: browser.runtime.getURL(`/options.html${hash}`) });
  });
});
