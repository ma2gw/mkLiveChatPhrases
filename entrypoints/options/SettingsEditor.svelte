<script lang="ts">
  /**
   * 右側: 設定
   * - メニュー（未登録では出さない、Enter で確定）
   * - 見た目（メニューの色、ボーダーの色、アイコンの色、背景の不透明度）
   * 設定はフレーズのデータとは別で、チェックを変えたらすぐに保存する（保存ボタンは使わない）
   */
  import { onDestroy } from 'svelte';
  import { t } from '../../lib/i18n';
  import {
    loadSettings,
    OPACITY_MAX,
    OPACITY_MIN,
    saveSettings,
    watchSettings,
    type Settings,
  } from '../../lib/storage/settings';

  let settings = $state<Settings | null>(null);
  let failed = $state(false);

  loadSettings().then((s) => (settings = s));
  // 別のタブや PC で変わったら反映する
  onDestroy(watchSettings((s) => (settings = s)));

  function setFlag(key: 'submitOnEnter' | 'hideUnregistered', value: boolean) {
    if (!settings) return;
    settings[key] = value;
    void save();
  }

  // ---------------------------------------------------------------------------
  // 見た目（色はピッカーを閉じたとき、不透明度はつまみを離したときに保存する。
  // 動かしている途中で何度も保存すると、storage.sync の書き込みの回数制限にかかるため）
  // ---------------------------------------------------------------------------

  type ColorKey = 'menuColor' | 'borderColor' | 'iconColor';
  /** 色の欄。auto は省略したときの説明、shown は省略したときにピッカーに出しておく色 */
  const COLOR_FIELDS: { key: ColorKey; label: string; auto: string; shown: string }[] = [
    { key: 'menuColor', label: 'menuColor', auto: 'autoTheme', shown: '#ffffff' },
    { key: 'borderColor', label: 'borderColor', auto: 'autoFromMenu', shown: '#d9d9d9' },
    { key: 'iconColor', label: 'iconColor', auto: 'defaultValue', shown: '#1e8e3e' },
  ];

  function setColor(key: ColorKey, value: string | undefined) {
    if (!settings) return;
    if (value) settings.appearance[key] = value;
    else delete settings.appearance[key];
    void save();
  }

  /** 不透明度のつまみを動かしている途中の値（離したら保存する） */
  let opacityDraft = $state<number | null>(null);
  function saveOpacity(value: number) {
    if (!settings) return;
    settings.appearance.opacity = value;
    opacityDraft = null;
    void save();
  }

  async function save() {
    if (!settings) return;
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
<p class="muted">{t('settingsHelp')}</p>

<h3>{t('menuHeading')}</h3>
{#if settings}
  <ul>
    <li>
      <label>
        <input
          type="checkbox"
          checked={settings.hideUnregistered}
          onchange={(e) => setFlag('hideUnregistered', e.currentTarget.checked)}
        />
        <span>{t('hideUnregistered')}</span>
      </label>
    </li>
    <li>
      <label>
        <input
          type="checkbox"
          checked={settings.submitOnEnter}
          onchange={(e) => setFlag('submitOnEnter', e.currentTarget.checked)}
        />
        <span>{t('submitOnEnter')}</span>
      </label>
    </li>
  </ul>
{/if}

<h3>{t('appearanceHeading')}</h3>
<p class="muted">{t('appearanceHelp')}</p>
{#if settings}
  <div class="appearance">
    {#each COLOR_FIELDS as field (field.key)}
      {@const value = settings.appearance[field.key]}
      <span class="name">{t(field.label)}</span>
      <span class="value">
        <input
          type="color"
          value={value ?? field.shown}
          onchange={(e) => setColor(field.key, e.currentTarget.value)}
          aria-label={t(field.label)}
        />
        <span class="muted">{value ? value : t(field.auto)}</span>
        <button type="button" onclick={() => setColor(field.key, undefined)} disabled={!value}>
          {t('resetToDefault')}
        </button>
      </span>
    {/each}

    <span class="name">{t('menuOpacity')}</span>
    <span class="value">
      <input
        type="range"
        min={OPACITY_MIN}
        max={OPACITY_MAX}
        step="5"
        value={opacityDraft ?? settings.appearance.opacity}
        oninput={(e) => (opacityDraft = Number(e.currentTarget.value))}
        onchange={(e) => saveOpacity(Number(e.currentTarget.value))}
        aria-label={t('menuOpacity')}
      />
      <span class="muted">{opacityDraft ?? settings.appearance.opacity}%</span>
      <button
        type="button"
        onclick={() => saveOpacity(OPACITY_MAX)}
        disabled={settings.appearance.opacity === OPACITY_MAX}
      >
        {t('resetToDefault')}
      </button>
    </span>
  </div>
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
  .muted {
    color: var(--muted);
  }
  /* 見た目: 左に項目名、右に選ぶもの・今の値・初期値に戻す */
  .appearance {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 8px 12px;
    align-items: center;
  }
  .appearance .value {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .appearance input[type='color'] {
    width: 40px;
    height: 28px;
    padding: 2px;
    cursor: pointer;
  }
  .appearance input[type='range'] {
    width: 160px;
    padding: 0;
    border: none;
  }
  .error {
    color: var(--danger);
  }
</style>
