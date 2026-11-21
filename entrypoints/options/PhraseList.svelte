<script lang="ts">
  /**
   * フレーズの一覧の編集（共通とチャンネルで共用）
   * 1 行 = 表示名（省略可）とコピーする文字列。≡ をドラッグして並べ替える
   */
  import { t } from '../../lib/i18n';
  import { moveInArray } from '../../lib/model/edit';
  import { newId, type Phrase } from '../../lib/model/types';
  import { dragging, endDrag, hintAt, overEnd, overRow, startDrag } from './dnd.svelte';
  import { editor } from './state.svelte';

  /** phrases は editor.draft の中の配列（直接書き換える）。list はドラッグの並びの名前 */
  let { phrases, list }: { phrases: Phrase[]; list: string } = $props();

  let rows: HTMLElement[] = $state([]);

  function add() {
    phrases.push({ id: newId(), text: '' });
    // 追加した行の「コピーする文字列」に入力できるようにする
    queueMicrotask(() => rows[phrases.length - 1]?.querySelector<HTMLInputElement>('.text')?.focus());
  }

  function drop(e: DragEvent, at: number | null) {
    const d = dragging('phrase');
    if (d && d.list === list && at !== null) {
      e.preventDefault();
      moveInArray(phrases, d.index, at);
    }
    endDrag();
  }

  const invalid = (id: string) => editor.errors.some((e) => e.code === 'emptyPhrase' && e.detail === id);
</script>

<ul class="phrases">
  {#each phrases as phrase, i (phrase.id)}
    <li
      bind:this={rows[i]}
      data-drag-row
      class:hint={hintAt('phrase', list, i)}
      ondragover={(e) => overRow(e, 'phrase', list, i)}
      ondrop={(e) => drop(e, overRow(e, 'phrase', list, i))}
    >
      <span
        class="handle"
        draggable="true"
        title={t('dragHandle')}
        role="button"
        tabindex="-1"
        ondragstart={(e) => startDrag(e, { kind: 'phrase', list, index: i, id: phrase.id })}
        ondragend={endDrag}>≡</span
      >
      <input class="label" placeholder={t('phraseLabel')} bind:value={phrase.label} />
      <input class="text" class:invalid={invalid(phrase.id)} placeholder={t('phraseText')} bind:value={phrase.text} />
      <button type="button" class="remove" title={t('deletePhrase')} onclick={() => phrases.splice(i, 1)}>×</button>
    </li>
  {/each}
  <li
    class="end"
    class:hint={hintAt('phrase', list, phrases.length)}
    ondragover={(e) => overEnd(e, 'phrase', list, phrases.length)}
    ondrop={(e) => drop(e, overEnd(e, 'phrase', list, phrases.length))}
  >
    <button type="button" onclick={add}>{t('addPhraseRow')}</button>
  </li>
</ul>

<style>
  .phrases {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 3px 0;
    border-top: 2px solid transparent;
  }
  li.hint {
    border-top-color: var(--accent);
  }
  .handle {
    cursor: grab;
    color: var(--muted);
    padding: 0 4px;
    user-select: none;
  }
  .label {
    flex: 0 0 25%;
  }
  .text {
    flex: 1;
  }
  .invalid {
    border-color: var(--danger);
  }
  .end {
    padding-top: 6px;
  }
</style>
