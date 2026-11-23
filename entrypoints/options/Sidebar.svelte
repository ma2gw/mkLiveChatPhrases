<script lang="ts">
  /**
   * 左側: 上に [フレーズ] [設定] のタブ。フレーズのタブでは 全チャンネル共通 / グループ / チャンネル の一覧
   * - 押せる行は右端に › を出す（見出しと見分けるため）。クリックで右側に編集するものを出す
   * - ≡ をドラッグして、グループやチャンネルを並べ替える。チャンネルはグループの間でも動かせる
   * - グループの見出しにチャンネルを落とすと、そのグループの最後に入る
   * - グループ（とグループなし）の見出しの右の A→Z で、中のチャンネルを名前の順に並べる（チャンネルが 2 つ以上のとき）
   */
  import { t } from '../../lib/i18n';
  import { addChannel, addGroup, moveChannel, moveInArray, placeOf, sortChannelsByName } from '../../lib/model/edit';
  import { channelDisplayName, type Channel } from '../../lib/model/types';
  import { dragging, endDrag, hintAt, overEnd, overRow, startDrag } from './dnd.svelte';
  import { editor, type Selection } from './state.svelte';

  /** ドラッグの並びの名前。グループなしは '' */
  const UNGROUPED = '';

  const data = $derived(editor.draft!);
  let collapsed: Record<string, boolean> = $state({});

  const isSelected = (s: Selection) =>
    editor.selection.kind === s.kind && (!('id' in s) || ('id' in editor.selection && editor.selection.id === s.id));

  const channelsOf = (ids: string[]) => ids.map((id) => data.channels[id]).filter((c): c is Channel => !!c);

  function dropChannel(e: DragEvent, list: string, at: number | null) {
    const d = dragging('channel');
    if (d && at !== null) {
      e.preventDefault();
      moveChannel(data, d.id, list === UNGROUPED ? null : list, at);
    }
    endDrag();
  }

  function dropGroup(e: DragEvent, at: number | null) {
    const d = dragging('group');
    if (d && at !== null) {
      e.preventDefault();
      moveInArray(data.groups, d.index, at);
    }
    endDrag();
  }

  function newGroup() {
    const g = addGroup(data, t('newGroupName'));
    editor.selection = { kind: 'group', id: g.id };
  }

  const onSettingsTab = $derived(editor.selection.kind === 'settings');
  /** フレーズのタブに戻ったときに、前に選んでいたものを選び直す */
  let lastPhraseSelection: Selection = { kind: 'global' };
  $effect(() => {
    if (editor.selection.kind !== 'settings') lastPhraseSelection = editor.selection;
  });

  function showPhrasesTab() {
    const s = lastPhraseSelection;
    // 前に選んでいたものが消えていたら、全チャンネル共通にする
    const exists =
      s.kind === 'global' ||
      (s.kind === 'channel' && s.id in data.channels) ||
      (s.kind === 'group' && data.groups.some((g) => g.id === s.id));
    editor.selection = exists ? s : { kind: 'global' };
  }

  /** 選んでいるグループ（またはチャンネルが入っているグループ）に作る */
  function newChannel() {
    const s = editor.selection;
    const place = s.kind === 'group' ? s.id : s.kind === 'channel' ? (placeOf(data, s.id) ?? null) : null;
    const ch = addChannel(data, place);
    editor.selection = { kind: 'channel', id: ch.id };
  }
</script>

{#snippet channelRows(list: string, ids: string[])}
  <ul class="channels">
    {#each channelsOf(ids) as channel, i (channel.id)}
      <li
        data-drag-row
        class:hint={hintAt('channel', list, i)}
        ondragover={(e) => overRow(e, 'channel', list, i)}
        ondrop={(e) => dropChannel(e, list, overRow(e, 'channel', list, i))}
      >
        <span
          class="handle"
          draggable="true"
          title={t('dragHandle')}
          role="button"
          tabindex="-1"
          ondragstart={(e) => startDrag(e, { kind: 'channel', list, index: i, id: channel.id })}
          ondragend={endDrag}>≡</span
        >
        <button
          type="button"
          class="item"
          class:selected={isSelected({ kind: 'channel', id: channel.id })}
          onclick={() => (editor.selection = { kind: 'channel', id: channel.id })}
        >
          <span class="item-label">{channelDisplayName(channel) || t('unnamedChannel')}</span>
        </button>
      </li>
    {/each}
    <!-- 並びの最後に落とす場所 -->
    <li
      class="end"
      class:hint={hintAt('channel', list, ids.length)}
      ondragover={(e) => overEnd(e, 'channel', list, ids.length)}
      ondrop={(e) => dropChannel(e, list, overEnd(e, 'channel', list, ids.length))}
    ></li>
  </ul>
{/snippet}

<div class="tabs" role="tablist">
  <button type="button" role="tab" class="tab" aria-selected={!onSettingsTab} onclick={showPhrasesTab}
    >{t('phrasesTab')}</button
  >
  <button
    type="button"
    role="tab"
    class="tab"
    aria-selected={onSettingsTab}
    onclick={() => (editor.selection = { kind: 'settings' })}>{t('settings')}</button
  >
</div>

{#if !onSettingsTab}
<nav>
  <button
    type="button"
    class="item"
    class:selected={isSelected({ kind: 'global' })}
    onclick={() => (editor.selection = { kind: 'global' })}><span class="item-label">{t('globalPhrasesLong')}</span></button
  >

  <ul class="groups">
    {#each data.groups as group, gi (group.id)}
      <li>
        <div
          class="group-head"
          data-drag-row
          class:hint={hintAt('group', 'groups', gi)}
          ondragover={(e) => overRow(e, 'group', 'groups', gi) ?? overEnd(e, 'channel', group.id, group.channelIds.length)}
          ondrop={(e) =>
            dragging('group')
              ? dropGroup(e, overRow(e, 'group', 'groups', gi))
              : dropChannel(e, group.id, overEnd(e, 'channel', group.id, group.channelIds.length))}
          role="group"
        >
          <span
            class="handle"
            draggable="true"
            title={t('dragHandle')}
            role="button"
            tabindex="-1"
            ondragstart={(e) => startDrag(e, { kind: 'group', list: 'groups', index: gi, id: group.id })}
            ondragend={endDrag}>≡</span
          >
          <button type="button" class="toggle" onclick={() => (collapsed[group.id] = !collapsed[group.id])}
            >{collapsed[group.id] ? '▸' : '▾'}</button
          >
          <button
            type="button"
            class="item"
            class:selected={isSelected({ kind: 'group', id: group.id })}
            onclick={() => (editor.selection = { kind: 'group', id: group.id })}
          >
            <span class="item-label">{group.name || t('unnamedGroup')}</span>
          </button>
          {#if group.channelIds.length >= 2}
            <button type="button" class="sort" title={t('sortByName')} onclick={() => sortChannelsByName(data, group.id)}
              >A→Z</button
            >
          {/if}
        </div>
        {#if !collapsed[group.id]}
          {@render channelRows(group.id, group.channelIds)}
        {/if}
      </li>
    {/each}
    <li
      class="end"
      class:hint={hintAt('group', 'groups', data.groups.length)}
      ondragover={(e) => overEnd(e, 'group', 'groups', data.groups.length)}
      ondrop={(e) => dropGroup(e, overEnd(e, 'group', 'groups', data.groups.length))}
    ></li>
  </ul>

  <div
    class="group-head ungrouped"
    ondragover={(e) => overEnd(e, 'channel', UNGROUPED, data.ungroupedChannelIds.length)}
    ondrop={(e) => dropChannel(e, UNGROUPED, overEnd(e, 'channel', UNGROUPED, data.ungroupedChannelIds.length))}
    role="group"
  >
    <span class="ungrouped-label">{t('ungrouped')}</span>
    <!-- グループなしには編集画面がないので、見出しの横に並べ替えのボタンを置く -->
    {#if data.ungroupedChannelIds.length >= 2}
      <button type="button" class="sort" title={t('sortByName')} onclick={() => sortChannelsByName(data, null)}
        >A→Z</button
      >
    {/if}
  </div>
  {@render channelRows(UNGROUPED, data.ungroupedChannelIds)}

  <div class="actions">
    <button type="button" onclick={newGroup}>{t('addGroup')}</button>
    <button type="button" onclick={newChannel}>{t('addChannel')}</button>
  </div>
</nav>
{/if}

<style>
  /* タブ: 選んでいるものに下線 */
  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }
  .tab {
    padding: 6px 12px;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: none;
    box-shadow: none;
    transform: none;
    color: var(--muted);
  }
  .tab:hover {
    color: var(--fg);
    background: none;
  }
  .tab[aria-selected='true'] {
    border-bottom-color: var(--accent);
    color: var(--fg);
    font-weight: bold;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .channels {
    padding-left: 20px;
  }
  li,
  .group-head {
    display: flex;
    align-items: center;
    gap: 2px;
    border-top: 2px solid transparent;
  }
  .groups > li {
    display: block;
  }
  .hint {
    border-top-color: var(--accent);
  }
  .end {
    min-height: 6px;
  }
  .group-head {
    margin-top: 6px;
    font-weight: bold;
  }
  /* 押せない見出し: 小さく薄い文字。行の背景は付けない */
  .ungrouped {
    margin-top: 12px;
    padding: 2px 6px 2px 22px;
    color: var(--muted);
    font-size: 12px;
    font-weight: normal;
  }
  .ungrouped-label {
    flex: 1;
  }
  /* グループなしの並べ替え: 見出しと同じく小さく薄い文字。押せることはマウスを乗せた背景で示す */
  .sort {
    padding: 0 6px;
    border: none;
    border-radius: 4px;
    background: none;
    box-shadow: none;
    transform: none;
    color: var(--muted);
    font-size: 11px;
    font-weight: normal;
  }
  .sort:hover {
    background: var(--hover);
    color: var(--fg);
  }
  .handle {
    cursor: grab;
    color: var(--muted);
    padding: 0 4px;
    user-select: none;
  }
  /* ▾ はボタンの見た目（塗りと影）にしない */
  .toggle {
    border: none;
    background: none;
    box-shadow: none;
    transform: none;
    color: var(--muted);
    padding: 0 2px;
  }
  .toggle:hover {
    background: var(--hover);
  }
  /* 押せる行（全チャンネル共通 / グループ / チャンネル）: 右端に ›。マウスを乗せると背景 */
  .item {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: none;
    box-shadow: none;
    transform: none;
    color: inherit;
    font: inherit;
    text-align: left;
  }
  .item::after {
    content: '›';
    flex: none;
    margin-left: auto;
    color: var(--muted);
    font-weight: normal;
  }
  .item-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .item:hover {
    background: var(--hover);
  }
  .item.selected,
  .item.selected:hover {
    background: var(--selected);
    font-weight: bold;
  }
  .actions {
    display: flex;
    gap: 6px;
    margin-top: 12px;
  }
</style>
