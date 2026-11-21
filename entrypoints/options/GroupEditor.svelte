<script lang="ts">
  /** 右側: グループの編集 */
  import { t } from '../../lib/i18n';
  import { deleteGroup } from '../../lib/model/edit';
  import { editor } from './state.svelte';

  let { id }: { id: string } = $props();

  const data = $derived(editor.draft!);
  const group = $derived(data.groups.find((g) => g.id === id));

  function remove() {
    if (!group || !confirm(t('deleteGroupConfirm', group.name || t('unnamedGroup')))) return;
    deleteGroup(data, id);
    editor.selection = { kind: 'global' };
  }
</script>

{#if group}
  <h2>{group.name || t('unnamedGroup')}</h2>
  <div class="fields">
    <label>
      <span>{t('groupName')}</span>
      <input bind:value={group.name} />
    </label>
  </div>
  <p class="muted">{t('channelCount', String(group.channelIds.length))}</p>
  <div class="danger">
    <button type="button" onclick={remove}>{t('deleteGroup')}</button>
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
  label span,
  .muted {
    color: var(--muted);
  }
  .danger {
    margin-top: 24px;
  }
</style>
