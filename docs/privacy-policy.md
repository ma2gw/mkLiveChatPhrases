# mkLiveChatPhrases プライバシーポリシー

最終更新日: 2026 年 11 月 22 日

[English follows Japanese.](#mklivechatphrases-privacy-policy)

mkLiveChatPhrases（以下「本拡張機能」）は、ライブ配信のチャットで使う定型文をクリップボードにコピーするためのブラウザー拡張機能です。本拡張機能は、利用者の情報を開発者や第三者に送信しません。

## 扱う情報と保存する場所

| 情報 | 保存する場所 |
|---|---|
| 利用者が登録した定型文、チャンネル（表示名、ハンドル、チャンネル ID）、グループ | `chrome.storage.sync` |
| 設定（メニューの表示に関する設定、見た目） | `chrome.storage.sync` |
| メニューの位置、開閉の状態、メニューを隠しているかどうか | `chrome.storage.local`（その端末だけ） |

- `chrome.storage.sync` のデータは、ブラウザーの同期機能がオンのとき、利用者自身の Google アカウント（Microsoft Edge では Microsoft アカウント）を通じて、利用者のほかの端末と同期されます。この同期はブラウザーの機能であり、開発者はデータを受け取りません。
- 本拡張機能は、YouTube、Twitch、ツイキャスのページで、今見ているチャンネルを判定するために、ページの URL とチャンネルへのリンクを読み取ります。読み取った情報は、利用者がチャンネルを登録したときにだけ保存します。
- クリップボードには、利用者が定型文のボタンを押したときにだけ書き込みます。クリップボードの内容は読み取りません。
- エクスポートの機能で書き出したファイルは、利用者が選んだ場所に保存されるだけで、どこにも送信しません。

## 送信と共有

- 本拡張機能は、外部のサーバーと通信しません。
- アクセス解析、広告、トラッキングは使いません。
- 情報を販売したり、第三者と共有したりしません。

## 情報の削除

- 定型文、チャンネル、グループは、編集画面からいつでも削除できます。
- 本拡張機能を削除すると、`chrome.storage.local` のデータは消えます。`chrome.storage.sync` のデータは、ブラウザーの同期の設定から削除できます。

## 権限

| 権限 | 使う目的 |
|---|---|
| `storage` | 定型文と設定を保存するため |
| `www.youtube.com`、`www.twitch.tv`、`twitcasting.tv` へのアクセス | 配信のページにメニューを表示し、今見ているチャンネルを判定するため |

## 変更

このポリシーを変更したときは、このページを更新し、最終更新日を改めます。

## サポート

本拡張機能は現状のまま無保証で提供し、個別のサポートは行いません。

---

# mkLiveChatPhrases Privacy Policy

Last updated: November 22, 2026

mkLiveChatPhrases ("the extension") is a browser extension that copies preset phrases for live stream chats to the clipboard. The extension does not send any user information to the developer or to third parties.

## Information handled and where it is stored

| Information | Storage |
|---|---|
| Phrases, channels (display name, handle, channel ID) and groups registered by the user | `chrome.storage.sync` |
| Settings (menu behavior and appearance) | `chrome.storage.sync` |
| Menu position, open/closed state, and whether the menu is hidden | `chrome.storage.local` (this device only) |

- When browser sync is turned on, data in `chrome.storage.sync` is synced to the user's other devices through the user's own Google account (or Microsoft account in Microsoft Edge). This sync is a browser feature; the developer does not receive the data.
- On YouTube, Twitch and TwitCasting pages, the extension reads the page URL and channel links to identify the channel being viewed. This information is stored only when the user registers the channel.
- The extension writes to the clipboard only when the user clicks a phrase button. It never reads the clipboard.
- Files created with the export feature are saved only to a location the user chooses and are not sent anywhere.

## Transmission and sharing

- The extension does not communicate with any external server.
- The extension does not use analytics, advertising, or tracking.
- The extension does not sell information or share it with third parties.

## Deleting information

- Phrases, channels and groups can be deleted at any time in the editor.
- Removing the extension deletes the data in `chrome.storage.local`. Data in `chrome.storage.sync` can be deleted from the browser's sync settings.

## Permissions

| Permission | Purpose |
|---|---|
| `storage` | To save phrases and settings |
| Access to `www.youtube.com`, `www.twitch.tv` and `twitcasting.tv` | To show the menu on stream pages and identify the channel being viewed |

## Changes

If this policy changes, this page will be updated along with the "Last updated" date.

## Support

The extension is provided "as is", without warranty of any kind, and no individual support is provided.
