<script lang="ts">
  /**
   * 編集画面
   * - 左に一覧、右に選んだものの編集
   * - 下書き（editor.draft）を直接書き換え、保存ボタン（または Ctrl+S）で storage.sync に書く
   * - 保存していない変更があるときにタブを閉じようとしたら警告する
   * - インポートは今のデータをすべて入れ替える（確認してから）
   * - URL の #channel=<id> で、そのチャンネルを選んだ状態で開く（メニューの「編集」から）
   */
  import { onDestroy, untrack } from 'svelte';
  import { t } from '../../lib/i18n';
  import { canonicalJson } from '../../lib/model/compare';
  import { addChannel, normalizeForSave } from '../../lib/model/edit';
  import { findChannel } from '../../lib/model/match';
  import type { PhraseData } from '../../lib/model/types';
  import { checkRules } from '../../lib/model/validate';
  import { exportToJson, importFromJson } from '../../lib/storage/importExport';
  import {
    checkSyncQuota,
    loadData,
    NewerSchemaVersionError,
    saveData,
    splitForSync,
    watchData,
  } from '../../lib/storage/sync';
  import ChannelEditor from './ChannelEditor.svelte';
  import { errorMessages } from './errors';
  import GroupEditor from './GroupEditor.svelte';
  import PhraseList from './PhraseList.svelte';
  import Sidebar from './Sidebar.svelte';
  import { editor } from './state.svelte';

  let saving = $state(false);
  let fileInput: HTMLInputElement;

  const dirty = $derived(editor.draft !== null && canonicalJson(editor.draft) !== editor.savedJson);

  // エラーが出ているあいだは、編集するたびにチェックし直す
  // （直したものや消したもののエラーが残らないように。エラーが出ていないときは何もしない）
  $effect(() => {
    if (!editor.draft) return;
    const data = $state.snapshot(editor.draft) as PhraseData; // 下書きのどこが変わっても、ここが動く
    if (untrack(() => editor.errors.length) === 0) return;
    normalizeForSave(data);
    const ruleErrors = checkRules(data);
    editor.errors = ruleErrors.length > 0 ? ruleErrors : checkSyncQuota(splitForSync(data));
  });

  /** 読み込んだ / 保存したデータを、下書きと比べる元にする */
  function setSaved(data: PhraseData) {
    editor.draft = data;
    editor.savedJson = canonicalJson(data);
    editor.externalChange = false;
  }

  function showNotice(message: string) {
    editor.notice = message;
    setTimeout(() => {
      if (editor.notice === message) editor.notice = '';
    }, 2000);
  }

  // ---------------------------------------------------------------------------
  // 読み込み
  // ---------------------------------------------------------------------------

  /**
   * URL の # から、開いたときに選ぶものを決める（メニューから開いたとき）
   * - #channel=<id>: そのチャンネルを選ぶ
   * - #new&handle=…&uc=…: そのハンドルとチャンネル ID を入れたチャンネルを「グループなし」に作って選ぶ
   *   （下書きに作るだけ。保存するまでは登録されない。すでに登録されていれば、それを選ぶ）
   */
  function selectFromHash() {
    const draft = editor.draft;
    if (!draft) return;
    const params = new URLSearchParams(location.hash.slice(1));
    const id = params.get('channel');
    if (id && draft.channels[id]) {
      editor.selection = { kind: 'channel', id };
    } else if (params.has('new')) {
      const page = { handle: params.get('handle') ?? undefined, youtubeChannelId: params.get('uc') ?? undefined };
      if (page.handle || page.youtubeChannelId) {
        let channel = findChannel(draft, page);
        if (!channel) {
          channel = addChannel(draft, null);
          if (page.handle) channel.handle = page.handle;
          if (page.youtubeChannelId) channel.youtubeChannelId = page.youtubeChannelId;
        }
        editor.selection = { kind: 'channel', id: channel.id };
      }
      // 読み込み直したときに、もう一度作らないようにする
      history.replaceState(null, '', location.pathname);
    }
  }

  loadData().then(
    (d) => {
      setSaved(d);
      selectFromHash();
    },
    (e: unknown) => (editor.loadError = e instanceof NewerSchemaVersionError ? 'newerSchemaVersion' : 'loadFailed'),
  );

  // 別のタブ、メニューの +、別の PC で保存されたデータが変わったとき
  const stopWatching = watchData((d) => {
    if (canonicalJson(d) === editor.savedJson) return; // 自分が保存したもの
    if (dirty) editor.externalChange = true; // 編集中のものは消さずに知らせる
    else setSaved(d);
  });

  function reload() {
    if (dirty && !confirm(t('discardConfirm'))) return;
    loadData().then(setSaved, () => (editor.loadError = 'loadFailed'));
  }

  // ---------------------------------------------------------------------------
  // 保存
  // ---------------------------------------------------------------------------

  async function save() {
    if (!editor.draft || saving) return;
    const data = $state.snapshot(editor.draft) as PhraseData;
    normalizeForSave(data);
    const ruleErrors = checkRules(data);
    if (ruleErrors.length > 0) {
      editor.errors = ruleErrors;
      return;
    }
    saving = true;
    try {
      const result = await saveData(data);
      if (result.ok) {
        editor.errors = [];
        setSaved(data);
        showNotice(t('saved'));
      } else {
        editor.errors = result.errors;
      }
    } catch (e) {
      console.warn('[LiveChatPhrases] 保存できませんでした', e);
      editor.errors = [{ code: 'invalidShape', detail: String(e) }];
    } finally {
      saving = false;
    }
  }

  // ---------------------------------------------------------------------------
  // インポート / エクスポート
  // ---------------------------------------------------------------------------

  function exportFile() {
    if (!editor.draft) return;
    const blob = new Blob([exportToJson($state.snapshot(editor.draft) as PhraseData)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `live-chat-phrases-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    const result = importFromJson(await file.text());
    fileInput.value = ''; // 同じファイルをもう一度選べるようにする
    if (!result.ok) {
      editor.errors = result.errors;
      return;
    }
    if (!confirm(t(dirty ? 'importConfirmUnsaved' : 'importConfirm'))) return;
    const saved = await saveData(result.value);
    if (!saved.ok) {
      editor.errors = saved.errors;
      return;
    }
    editor.errors = [];
    setSaved(result.value);
    editor.selection = { kind: 'global' };
    showNotice(t('imported'));
  }

  // ---------------------------------------------------------------------------
  // キー操作とタブを閉じるとき
  // ---------------------------------------------------------------------------

  function onKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      void save();
    }
  }

  function onBeforeUnload(e: BeforeUnloadEvent) {
    if (dirty) e.preventDefault();
  }

  onDestroy(stopWatching);
</script>

<svelte:window onkeydown={onKeydown} onbeforeunload={onBeforeUnload} onhashchange={selectFromHash} />

<header>
  <div class="header-inner">
  <h1>{t('extName')}</h1>
  <div class="bar">
    <span class="status">
      {#if editor.notice}{editor.notice}{:else if dirty}{t('unsaved')}{/if}
    </span>
    <button type="button" class="primary" onclick={save} disabled={!dirty || saving}>{t('save')}</button>
    <button type="button" onclick={() => fileInput.click()}>{t('import')}</button>
    <button type="button" onclick={exportFile} disabled={dirty} title={dirty ? t('exportNeedsSave') : ''}
      >{t('export')}</button
    >
    <input
      bind:this={fileInput}
      type="file"
      accept="application/json,.json"
      hidden
      onchange={(e) => importFile(e.currentTarget.files?.[0])}
    />
  </div>
  </div>
</header>

<div class="page">

{#if editor.externalChange}
  <p class="banner">
    {t('externalChange')}
    <button type="button" onclick={reload}>{t('reloadDiscard')}</button>
  </p>
{/if}

{#if editor.errors.length > 0}
  <ul class="errors">
    {#each errorMessages(editor.errors, editor.draft) as message (message)}
      <li>{message}</li>
    {/each}
  </ul>
{/if}

{#if editor.loadError}
  <p class="errors">{t(editor.loadError === 'newerSchemaVersion' ? 'errorNewerVersion' : 'errorLoadFailed')}</p>
{:else if editor.draft}
  <div class="layout">
    <aside><Sidebar /></aside>
    <main>
      {#if editor.selection.kind === 'channel'}
        {#key editor.selection.id}<ChannelEditor id={editor.selection.id} />{/key}
      {:else if editor.selection.kind === 'group'}
        {#key editor.selection.id}<GroupEditor id={editor.selection.id} />{/key}
      {:else}
        <h2>{t('globalPhrases')}</h2>
        <p class="muted">{t('globalPhrasesHelp')}</p>
        <PhraseList phrases={editor.draft.globalPhrases} list="global" />
      {/if}
    </main>
  </div>
{/if}
</div>

<style>
  header {
    position: sticky;
    top: 0;
    z-index: 1;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }
  /* 画面が広くても横に伸びすぎないように、中身の幅をそろえて中央に寄せる */
  .header-inner,
  .page {
    max-width: 1100px;
    margin: 0 auto;
  }
  .header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 24px;
  }
  h1 {
    margin: 0;
    font-size: 16px;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .status {
    color: var(--muted);
  }
  .banner,
  .errors {
    margin: 12px 24px 0;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 4px;
  }
  .errors {
    border-color: var(--danger);
    color: var(--danger);
    padding-left: 28px;
  }
  .layout {
    display: grid;
    grid-template-columns: 260px 1fr;
    gap: 24px;
    padding: 16px 24px;
  }
  aside {
    border-right: 1px solid var(--border);
    padding-right: 16px;
  }
  main {
    min-width: 0;
    max-width: 720px;
  }
  .muted {
    color: var(--muted);
  }
</style>
