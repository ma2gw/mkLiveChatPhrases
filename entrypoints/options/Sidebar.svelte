<script lang="ts">
  /**
   * 左側の一覧: 共通 / グループ / チャンネル
   * - クリックで右側に編集するものを出す
   * - ≡ をドラッグして、グループやチャンネルを並べ替える。チャンネルはグループの間でも動かせる
   * - グループの見出しにチャンネルを落とすと、そのグループの最後に入る
   */
  import { t } from '../../lib/i18n';
  import { addChannel, addGroup, moveChannel, moveInArray, placeOf } from '../../lib/model/edit';
  import { channelDisplayName, type Channel } from '../../lib/model/types';
  import { dragging, endDrag, hintAt, overEnd, overRow, startDrag } from './dnd.svelte';
  import { editor, type Selection } from './state.svelte';

  /** ドラッグの並びの名前。グループなしは '' */
  const UNGROUPED = '';

  const data = $derived(editor.draft!);
  let collapsed: Record<string, boolean> = $state({});

  const isSelected = (s: Selection) =>
    editor.selection.kind === s.kind && (s.kind === 'global' || ('id' in editor.selection && editor.selection.id === s.id));

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
          {channelDisplayName(channel) || t('unnamedChannel')}
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

<nav>
  <button
    type="button"
    class="item"
    class:selected={isSelected({ kind: 'global' })}
    onclick={() => (editor.selection = { kind: 'global' })}>{t('globalPhrases')}</button
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
            {group.name || t('unnamedGroup')}
          </button>
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
    {t('ungrouped')}
  </div>
  {@render channelRows(UNGROUPED, data.ungroupedChannelIds)}

  <div class="actions">
    <button type="button" onclick={newGroup}>{t('addGroup')}</button>
    <button type="button" onclick={newChannel}>{t('addChannel')}</button>
  </div>
</nav>

<style>
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
  .ungrouped {
    padding: 4px 6px 4px 22px;
    color: var(--muted);
  }
  .handle {
    cursor: grab;
    color: var(--muted);
    padding: 0 4px;
    user-select: none;
  }
  .toggle {
    border: none;
    background: none;
    color: var(--muted);
    padding: 0 2px;
  }
  .item {
    flex: 1;
    min-width: 0;
    padding: 4px 6px;
    border: none;
    border-radius: 4px;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .item:hover {
    background: var(--hover);
  }
  .item.selected {
    background: var(--selected);
  }
  .actions {
    display: flex;
    gap: 6px;
    margin-top: 12px;
  }
</style>
