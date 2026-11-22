<script lang="ts">
  /** 右側: チャンネルの編集 */
  import { t } from '../../lib/i18n';
  import { deleteChannel, moveChannel, placeOf } from '../../lib/model/edit';
  import { channelDisplayName, SITE_INFO, SITES, type Site, type SiteAccount } from '../../lib/model/types';
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

  /** ハンドルの欄の案内（サイトの見せ方は SITE_INFO） */
  const HANDLE_PLACEHOLDER: Record<Site, string> = { youtube: 'handle', twitch: t('twitchHandlePlaceholder') };

  /** サイトのアカウントの欄を書き換える。アカウントがまだなければ作る（空になったものは保存するときに消える） */
  function setAccount(site: Site, key: keyof SiteAccount, value: string) {
    if (!channel) return;
    const account = (channel.accounts[site] ??= {});
    account[key] = value;
  }

  /** ハンドルの入力。先頭の @（や /@）は外す（保存するときにも外すが、入力欄に残ると表示が @@ になるため） */
  function onHandleInput(site: Site, input: HTMLInputElement) {
    const value = input.value.replace(/^\s*\/?@+/, '');
    if (value !== input.value) input.value = value;
    setAccount(site, 'handle', value);
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
      <span>{t('group')}</span>
      <select value={placeOf(data, id) ?? ''} onchange={(e) => changeGroup(e.currentTarget.value)}>
        <option value="">{t('ungrouped')}</option>
        {#each data.groups as group (group.id)}
          <option value={group.id}>{group.name || t('unnamedGroup')}</option>
        {/each}
      </select>
    </label>

    <!-- サイトごとのアカウント（対応するサイトが増えたら、ここに欄が増える） -->
    {#each SITES as site (site)}
      {@const info = SITE_INFO[site]}
      <div class="site">{info.label}</div>
      <label>
        <span>{t('handle')}</span>
        <!-- @ は固定の文字として外に出し、入力欄には @ を入れない（@ 付きで入力・貼り付けしても、その場で外す） -->
        <span class="handle-field">
          {#if info.handlePrefix}<span class="at">{info.handlePrefix}</span>{/if}
          <input
            value={channel.accounts[site]?.handle ?? ''}
            oninput={(e) => onHandleInput(site, e.currentTarget)}
            class:invalid={missingKey}
            placeholder={HANDLE_PLACEHOLDER[site]}
          />
        </span>
      </label>
      {#if info.idPlaceholder !== null}
        <label>
          <span>{t('siteChannelId')}</span>
          <input
            value={channel.accounts[site]?.siteChannelId ?? ''}
            oninput={(e) => setAccount(site, 'siteChannelId', e.currentTarget.value)}
            class:invalid={missingKey}
            placeholder={info.idPlaceholder}
          />
        </label>
      {/if}
    {/each}
  </div>

  <h3>{t('phrases')}</h3>
  <PhraseList phrases={channel.phrases} list={id} />

  <div class="danger">
    <button type="button" class="danger" onclick={remove}>{t('deleteChannel')}</button>
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
  /* サイトの見出し（2 列にまたがる） */
  .site {
    grid-column: 1 / -1;
    margin-top: 10px;
    font-weight: bold;
  }
  /* @ を入力欄の左に固定で出す */
  .handle-field {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .handle-field .at {
    color: var(--muted);
  }
  .handle-field input {
    flex: 1;
  }
  .danger {
    margin-top: 24px;
  }
</style>
