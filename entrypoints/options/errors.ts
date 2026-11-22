/**
 * エラーのコードを、画面に出す文言にする
 * detail がチャンネルやフレーズの id のときは、どのチャンネルの話かが分かるように名前に直す
 * 内部の id は見せない（見つからなければ「（未設定）」にする）
 */
import { t } from '../../lib/i18n';
import { channelDisplayName, type PhraseData } from '../../lib/model/types';
import type { DataError } from '../../lib/model/validate';

/** エラーの一覧を文言にする。同じ文は 1 つにまとめる */
export function errorMessages(errors: DataError[], data: PhraseData | null): string[] {
  return [...new Set(errors.map((e) => errorMessage(e, data)))];
}

export function errorMessage(error: DataError, data: PhraseData | null): string {
  const detail = error.detail ?? '';
  /** 名前 → @ハンドル → チャンネル ID → （未設定） */
  const channelName = (id: string) => {
    const ch = data?.channels[id];
    return (ch && channelDisplayName(ch)) || t('unnamedChannel');
  };
  /** フレーズが入っている場所の名前（共通かチャンネル） */
  const ownerOfPhrase = (phraseId: string) => {
    if (data?.globalPhrases.some((p) => p.id === phraseId)) return t('globalPhrases');
    const ch = Object.values(data?.channels ?? {}).find((c) => c.phrases.some((p) => p.id === phraseId));
    return ch ? channelName(ch.id) : t('unnamedChannel');
  };

  switch (error.code) {
    case 'missingChannelKey':
      return t('errMissingChannelKey', channelName(detail));
    case 'duplicateHandle':
      return t('errDuplicateHandle', detail);
    case 'duplicateSiteChannelId':
      return t('errDuplicateSiteChannelId', detail);
    case 'emptyPhrase':
      return t('errEmptyPhrase', ownerOfPhrase(detail));
    case 'itemTooLarge':
      return t('errItemTooLarge', detail.startsWith('ch:') ? channelName(detail.slice(3)) : t('globalPhrases'));
    case 'totalTooLarge':
      return t('errTotalTooLarge');
    case 'tooManyItems':
      return t('errTooManyItems');
    case 'newerSchemaVersion':
      return t('errorNewerVersion');
    case 'invalidJson':
      return t('errInvalidJson');
    case 'unsupportedFormat':
      return t('errUnsupportedFormat');
    case 'invalidShape':
      return t('errInvalidShape', detail);
    default:
      // duplicateId / channelPlacement / unknownChannelRef: 普通に操作していれば起きない
      return t('errInconsistent', error.code, detail);
  }
}
