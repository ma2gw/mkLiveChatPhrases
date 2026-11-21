/**
 * JSON のエクスポートとインポート
 *
 * ファイルの形は PhraseData そのもの（schemaVersion を持つ）
 *
 * インポートは読んだ結果の PhraseData を返すだけで、保存はしない。
 * 今のデータと入れ替えるか、混ぜるかは呼ぶ側で決める
 */
import type { PhraseData } from '../model/types';
import { parsePhraseData, type Result } from '../model/validate';

/** エクスポートする JSON の文字列を作る */
export function exportToJson(data: PhraseData): string {
  return JSON.stringify(data, null, 2);
}

/** JSON の文字列を読む */
export function importFromJson(text: string): Result<PhraseData> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: [{ code: 'invalidJson' }] };
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json) || !('schemaVersion' in json)) {
    return { ok: false, errors: [{ code: 'unsupportedFormat' }] };
  }
  return parsePhraseData(migrate(json));
}

/**
 * 古い schemaVersion のデータを今の形に直す
 * 今は 1 しかないので何もしない。2 を作ったら、ここに 1 → 2 の変換を足す
 * （background の onInstalled からも同じ変換を使う）
 */
export function migrate(json: object): object {
  return json;
}
