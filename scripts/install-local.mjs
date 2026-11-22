/**
 * 普段使いの Chrome で試すためのビルド（npm run install:local）
 *
 * 1. local-build-key.txt がなければ作る（manifest の key。拡張機能の ID を固定する）
 *    - パッケージ化されていない拡張機能の ID は、置いたフォルダの場所で決まる
 *    - storage.sync は ID ごとに分かれるので、PC ごとに ID が違うと同期されない
 *    - key（公開鍵）を manifest に入れると、どの PC でも同じ ID になる
 *    - 中身は公開鍵だけで、秘密の情報ではない。ストアに出すビルドには入れない
 * 2. MK_LOCAL_BUILD=1 でビルドする（wxt.config.ts が key を manifest に入れる）
 * 3. .output/chrome-mv3 を local/MkLiveChatPhrases にコピーする
 *    （ビルドの途中で失敗しても、読み込んでいる拡張機能が壊れないように）
 */
import { execSync } from 'node:child_process';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const keyFile = resolve(root, 'local-build-key.txt');
const outDir = resolve(root, '.output/chrome-mv3');
const installDir = resolve(root, 'local/MkLiveChatPhrases');

// 1. key
if (!existsSync(keyFile)) {
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const der = publicKey.export({ type: 'spki', format: 'der' });
  writeFileSync(keyFile, der.toString('base64') + '\n');
  console.log(`key を作りました: ${keyFile}`);
}
const key = readFileSync(keyFile, 'utf8').trim();

// 2. ビルド
execSync('npx wxt build', { cwd: root, stdio: 'inherit', env: { ...process.env, MK_LOCAL_BUILD: '1' } });

// 3. コピー
rmSync(installDir, { recursive: true, force: true });
cpSync(outDir, installDir, { recursive: true });

// 拡張機能の ID: 公開鍵の SHA-256 の先頭 32 文字（16 進）を a〜p に置き換えたもの
const id = [...createHash('sha256').update(Buffer.from(key, 'base64')).digest('hex').slice(0, 32)]
  .map((c) => String.fromCharCode('a'.charCodeAt(0) + parseInt(c, 16)))
  .join('');

console.log(`
普段使いのビルドを置きました: ${installDir}
拡張機能の ID: ${id}

初めてのとき: chrome://extensions → デベロッパー モード → 「パッケージ化されていない拡張機能を読み込む」でこのフォルダを選ぶ
更新するとき: npm run install:local のあと、chrome://extensions のこの拡張機能の ↻ を押す
`);
