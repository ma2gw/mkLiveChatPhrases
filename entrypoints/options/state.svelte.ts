/**
 * 編集画面の状態（どのコンポーネントからも読み書きする）
 *
 * draft を直接書き換えて編集し、保存ボタンで storage に書く
 * savedJson と比べて、保存していない変更があるかを調べる
 */
import type { PhraseData } from '../../lib/model/types';
import type { DataError } from '../../lib/model/validate';

/** 右側で編集しているもの */
export type Selection = { kind: 'global' } | { kind: 'group'; id: string } | { kind: 'channel'; id: string };

export const editor = $state({
  /** 編集中のデータ（下書き）。読み込むまでは null */
  draft: null as PhraseData | null,
  /** 最後に読み込んだ / 保存したデータ（canonicalJson） */
  savedJson: '',
  selection: { kind: 'global' } as Selection,
  /** 保存やインポートで出たエラー */
  errors: [] as DataError[],
  /** 保存していない変更があるときに、別の場所で保存されたデータが変わった */
  externalChange: false,
  /** データを読めなかった理由 */
  loadError: null as null | 'newerSchemaVersion' | 'loadFailed',
  /** 一時的なお知らせ（「保存しました」など） */
  notice: '',
});
