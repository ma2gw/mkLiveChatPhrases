<script lang="ts">
  /**
   * 右側: 設定
   * - mod の有効 / 無効（無効にした mod はメニューに出ない）
   * 設定はフレーズのデータとは別で、チェックを変えたらすぐに保存する（保存ボタンは使わない）
   */
  import { onDestroy } from 'svelte';
  import { t } from '../../lib/i18n';
  import { MODS } from '../../lib/mods';
  import { loadSettings, saveSettings, watchSettings, type Settings } from '../../lib/storage/settings';

  let settings = $state<Settings | null>(null);
  let failed = $state(false);

  loadSettings().then((s) => (settings = s));
  // 別のタブや PC で変わったら反映する
  onDestroy(watchSettings((s) => (settings = s)));

  async function setEnabled(id: string, enabled: boolean) {
    if (!settings) return;
    const disabled = settings.disabledMods.filter((x) => x !== id);
    if (!enabled) disabled.push(id);
    settings.disabledMods = disabled;
    try {
      await saveSettings($state.snapshot(settings));
      failed = false;
    } catch (e) {
      console.warn('[MkLiveChatPhrases] 設定を保存できませんでした', e);
      failed = true;
    }
  }
</script>

<h2>{t('settings')}</h2>

<h3>{t('modsHeading')}</h3>
<p class="muted">{t('modsHelp')}</p>

{#if settings}
  <ul>
    {#each MODS as mod (mod.id)}
      <li>
        <label>
          <input
            type="checkbox"
            checked={!settings.disabledMods.includes(mod.id)}
            onchange={(e) => setEnabled(mod.id, e.currentTarget.checked)}
          />
          <span class="mod-label">{mod.label}</span>
          <span>{t(mod.messageKey)}</span>
        </label>
      </li>
    {/each}
  </ul>
{/if}

{#if failed}
  <p class="error">{t('settingsSaveFailed')}</p>
{/if}

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    padding: 4px 0;
  }
  label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  .mod-label {
    min-width: 32px;
    padding: 0 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-weight: bold;
    text-align: center;
  }
  .muted {
    color: var(--muted);
  }
  .error {
    color: var(--danger);
  }
</style>
