import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { apiUpdatePreferences, fetchPreferences, type Preferences } from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import type { TranslationKey } from '../../i18n/catalogs';
import type { BackgroundPreference } from '../../types/theme';
import { THEME_SWATCHES } from '../../utils/theme';
import { ToolbarSectionLabel } from './ToolbarSectionLabel';

// Automatic (follow the OS) stays in Settings; the menu offers the color themes only.
const MENU_THEMES: Array<{ value: BackgroundPreference; labelKey: TranslationKey }> = [
  { value: 'beige', labelKey: 'settings.beige' },
  { value: 'white', labelKey: 'settings.white' },
  { value: 'dark', labelKey: 'settings.dark' },
];

export function ThemeSwitcher() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  // AppShell already loads and syncs preferences; opening the menu should not refetch them.
  const { data: preferences } = useQuery({ queryKey: ['preferences'], queryFn: fetchPreferences, refetchOnMount: false });

  const mutation = useMutation({
    mutationFn: (background: BackgroundPreference) => apiUpdatePreferences({ background }),
    onMutate: async (background) => {
      await queryClient.cancelQueries({ queryKey: ['preferences'] });
      const previous = queryClient.getQueryData<Preferences>(['preferences']);
      if (previous) {
        queryClient.setQueryData<Preferences>(['preferences'], { ...previous, background });
      }
      return { previous };
    },
    onError: (_error, _background, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['preferences'], context.previous);
      }
    },
    onSuccess: (nextPreferences) => {
      queryClient.setQueryData(['preferences'], nextPreferences);
    },
  });

  const current = preferences?.background;

  return (
    <>
      <ToolbarSectionLabel>{t('menu.theme')}</ToolbarSectionLabel>
      <div role="radiogroup" aria-label={t('menu.theme')} className="theme-switcher flex items-center gap-2">
        {MENU_THEMES.map(({ value, labelKey }) => {
          const selected = current === value;
          const swatch = THEME_SWATCHES[value];
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t(labelKey)}
              title={t(labelKey)}
              disabled={!preferences}
              onClick={() => mutation.mutate(value)}
              className={`theme-switcher-swatch inline-flex h-6 w-6 items-center justify-center rounded-sm border transition-colors duration-(--motion-fast) disabled:cursor-not-allowed disabled:opacity-50 ${
                selected ? 'border-ink' : 'border-border hover:border-ink-light'
              }`}
              style={{ backgroundImage: swatch.paper, color: swatch.mark }}
            >
              {selected && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </>
  );
}
