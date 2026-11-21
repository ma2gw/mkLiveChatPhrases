<script lang="ts">
  /** 右側: チャンネルの編集 */
  import { t } from '../../lib/i18n';
  import { deleteChannel, moveChannel, placeOf } from '../../lib/model/edit';
  import { channelDisplayName } from '../../lib/model/types';
  import PhraseList from './PhraseList.svelte';
  import { editor } from './state.svelte';

  let { id }: { id: string } = $props();

  const data = $derived(editor.draft!);
  const channel = $derived(data.channels[id]);
  const missingKey = $derived(editor.errors.some((e) => e.code === 'missingChannelKey' && e.detail === id));

  /** グループを変えたら、そのグループの最後に入れる。'' はグループなし */
  function changeGroup(value: string) {
    const to = value || null;
    const list = to === null ? data.ungroupedChannelIds : (data.groups.find((g) => g.id === to)?.channelIds ?? []);
    moveChannel(data, id, to, list.length);
  }

  function remove() {
    if (!channel || !confirm(t('deleteChannelConfirm', channelDisplayName(channel) || t('unnamedChannel')))) return;
    deleteChannel(data, id);
    editor.selection = { kind: 'global' };
  }
</script>

{#if channel}
  <h2>{channelDisplayName(channel) || t('unnamedChannel')}</h2>

  <div class="fields">
    <label>
      <span>{t('channelName')}</span>
      <input bind:value={channel.name} placeholder={t('channelNamePlaceholder')} />
    </label>
    <label>
      <span>{t('handle')}</span>
      <input bind:value={channel.handle} class:invalid={missingKey} placeholder="@handle" />
    </label>
    <label>
      <span>{t('youtubeChannelId')}</span>
      <input bind:value={channel.youtubeChannelId} class:invalid={missingKey} placeholder="UC…" />
    </label>
    <label>
      <span>{t('group')}</span>
      <select value={placeOf(data, id) ?? ''} onchange={(e) => changeGroup(e.currentTarget.value)}>
        <option value="">{t('ungrouped')}</option>
        {#each data.groups as group (group.id)}
          <option value={group.id}>{group.name || t('unnamedGroup')}</option>
        {/each}
      </select>
    </label>
  </div>

  <h3>{t('phrases')}</h3>
  <PhraseList phrases={channel.phrases} list={id} />

  <div class="danger">
    <button type="button" onclick={remove}>{t('deleteChannel')}</button>
  </div>
{/if}

<style>
  .fields {
    display: grid;
    grid-template-columns: max-content minmax(0, 420px);
    gap: 6px 12px;
    align-items: center;
  }
  label {
    display: contents;
  }
  label span {
    color: var(--muted);
  }
  .invalid {
    border-color: var(--danger);
  }
  .danger {
    margin-top: 24px;
  }
</style>
