import { useEffect, type CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { Toggle } from '../ui/Toggle';
import { SettingsCard } from './SettingsFields';
import { useI18n } from '../../i18n/I18nContext';
import { ensureFontLoaded } from '../../utils/fontLoader';
import { handleRadioNavigation } from '../../utils/radioNavigation';
import { THEME_SWATCHES } from '../../utils/theme';
import type { Preferences } from '../../types/api';
import type { FontOption } from '../../types/utils';
import type { TranslationKey } from '../../i18n/catalogs';
import type { SettingsAppearanceProps } from '../../types/settings';

const FONT_OPTIONS: Array<{
  value: FontOption;
  label: string;
  previewClass: string;
}> = [
  {
    value: 'lora',
    label: 'Lora',
    previewClass: 'font-journal text-[14px] sm:text-[16px]',
  },
  {
    value: 'playpen',
    label: 'Playpen Sans',
    previewClass: 'font-playpen text-[14px] sm:text-[16px] leading-none',
  },
  {
    value: 'hubballi',
    label: 'Hubballi',
    previewClass: 'font-hubballi text-[14px] sm:text-[16px] leading-none',
  },
];

const BACKGROUND_OPTIONS: Array<{ value: Preferences['background']; labelKey: TranslationKey }> = [
  { value: 'beige', labelKey: 'settings.beige' },
  { value: 'white', labelKey: 'settings.white' },
  { value: 'dark', labelKey: 'settings.dark' },
  { value: 'nord-light', labelKey: 'settings.nordLight' },
  { value: 'nord-dark', labelKey: 'settings.nordDark' },
  { value: 'system', labelKey: 'settings.system' },
];

function backgroundPreviewStyle(paper: string, dot: string, showDots: boolean): CSSProperties {
  if (!showDots) return { backgroundImage: paper };
  return {
    backgroundImage: `radial-gradient(circle, ${dot} 1px, transparent 1px), ${paper}`,
    backgroundSize: 'var(--dot-grid) var(--dot-grid), auto',
    backgroundPosition: 'calc(var(--dot-grid) / 2) calc(var(--dot-grid) / 2), 0 0',
  };
}

function selectedFrame(selected: boolean) {
  return selected
    ? 'border-ink-light bg-[var(--planner-control-bg-hover)] text-ink'
    : 'border-border bg-[var(--planner-control-bg)] text-ink hover:bg-[var(--planner-control-bg-hover)]';
}

function selectedBorder(selected: boolean) {
  return selected ? 'border-ink-light' : 'border-border group-hover:border-border-subtle';
}

function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={`absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border ${
        selected ? 'border-ink bg-ink text-cream' : 'border-ink-light bg-transparent'
      }`}
      aria-hidden="true"
    >
      {selected && <Check size={12} strokeWidth={3} />}
    </span>
  );
}

export function SettingsAppearance({ preferences, updateMutation, panelHeadingId }: SettingsAppearanceProps) {
  const { t } = useI18n();
  useEffect(() => {
    void ensureFontLoaded('playpen');
    void ensureFontLoaded('hubballi');
  }, []);
  const font = preferences?.font ?? 'lora';
  const showDots = preferences?.showDots ?? true;
  const background = preferences?.background ?? 'beige';
  const smallCaps = preferences?.smallCaps ?? false;
  const showCheckboxes = preferences?.showCheckboxes ?? false;
  const disabled = updateMutation.isPending;

  const handleFontChange = (nextFont: FontOption) => {
    ensureFontLoaded(nextFont);
    updateMutation.mutate({ font: nextFont });
  };

  const handleDotsChange = (nextShowDots: boolean) => {
    updateMutation.mutate({ showDots: nextShowDots });
  };

  const handleBackgroundChange = (nextBackground: Preferences['background']) => {
    updateMutation.mutate({ background: nextBackground });
  };

  const handleSmallCapsChange = (next: boolean) => {
    updateMutation.mutate({ smallCaps: next });
  };

  const handleShowCheckboxesChange = (nextShowCheckboxes: boolean) => {
    updateMutation.mutate({ showCheckboxes: nextShowCheckboxes });
  };


  return (
    <SettingsCard
      title={t('settings.appearance')}
      headingId={panelHeadingId}
    >
      <div className="flex flex-col gap-10">
        <section className="space-y-4">
          <h3 className="text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium">
            {t('settings.typography')}
          </h3>
          <div className="grid max-w-[420px] grid-cols-1 gap-3" role="radiogroup" aria-label={t('settings.font')}>
            {FONT_OPTIONS.map(({ value, label, previewClass }) => {
              const selected = font === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => handleFontChange(value)}
                  className={`relative flex min-h-12 w-full items-center justify-start rounded-[6px] border py-3 pl-12 pr-4 text-left transition-colors duration-[var(--motion-fast)] disabled:cursor-not-allowed disabled:opacity-50 ${selectedFrame(selected)}`}
                >
                  <SelectionMark selected={selected} />
                  <span className={`${previewClass} leading-none`}>{label}</span>
                </button>
              );
            })}
          </div>
          <Toggle
            checked={smallCaps}
            onChange={handleSmallCapsChange}
            disabled={disabled}
            label={<span className="text-sm leading-6 text-ink">{t('settings.smallCaps')}</span>}
            className="[&_button]:!p-0"
          />
        </section>

        <section className="space-y-4 border-t border-[var(--planner-settings-separator)] pt-8">
          <h3 className="text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium">
            {t('settings.theme')}
          </h3>
          <div className="grid max-w-[584px] grid-cols-2 gap-6 sm:grid-cols-3" role="radiogroup" aria-label={t('settings.theme')} onKeyDown={handleRadioNavigation}>
            {BACKGROUND_OPTIONS.map(({ value, labelKey }) => {
              const selected = background === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  tabIndex={selected ? 0 : -1}
                  title={t(labelKey)}
                  onClick={() => handleBackgroundChange(value)}
                  className="group flex flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    className={`relative block h-[60px] w-full rounded-[6px] border transition-colors duration-[var(--motion-fast)] ${selectedBorder(selected)}`}
                    style={backgroundPreviewStyle(THEME_SWATCHES[value].paper, THEME_SWATCHES[value].dot, showDots)}
                  >
                    <SelectionMark selected={selected} />
                  </span>
                  <span className="text-base leading-6 text-ink opacity-80">
                    {t(labelKey)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col items-start gap-3">
            <Toggle
              checked={showDots}
              onChange={handleDotsChange}
              disabled={disabled}
              label={<span className="text-sm leading-6 text-ink">{t('settings.showDots')}</span>}
              className="[&_button]:!p-0"
            />
            <Toggle
              checked={showCheckboxes}
              onChange={handleShowCheckboxesChange}
              disabled={disabled}
              label={<span className="text-sm leading-6 text-ink">{t('settings.showCheckboxes')}</span>}
              className="[&_button]:!p-0"
            />
          </div>
        </section>
      </div>
    </SettingsCard>
  );
}
