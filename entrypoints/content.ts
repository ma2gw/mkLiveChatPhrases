// YouTube 上で動く content script（今は動作確認用のログを出すだけ）
export default defineContentScript({
  matches: ['*://www.youtube.com/*'],
  main() {
    console.log('[LiveChatPhrases] content script loaded:', location.href);
  },
});
