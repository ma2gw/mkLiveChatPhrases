export default defineBackground(() => {
  // 後で onInstalled でデータの移行（schemaVersion）を行う
  console.log('[LiveChatPhrases] background started', { id: browser.runtime.id });
});
