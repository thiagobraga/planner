import { useRef, type KeyboardEvent } from 'react';
import { Palette, PlugZap, Settings2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import type { SettingsSection, SettingsTabListProps } from '../../types/settings';

const SETTINGS_SECTIONS: Array<{
  key: SettingsSection;
  icon: typeof Settings2;
}> = [
  { key: 'general', icon: Settings2 },
  { key: 'appearance', icon: Palette },
  { key: 'integrations', icon: PlugZap },
];

export function SettingsTabList({
  activeSection,
  compact,
  idPrefix,
  inverted = false,
  onChange,
}: SettingsTabListProps) {
  const { t } = useI18n();
  const tabRefs = useRef<Record<SettingsSection, HTMLButtonElement | null>>({
    general: null,
    appearance: null,
    integrations: null,
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const direction =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;

    if (!direction && event.key !== 'Home' && event.key !== 'End') {
      return;
    }

    event.preventDefault();

    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? SETTINGS_SECTIONS.length - 1
          : (index + direction + SETTINGS_SECTIONS.length) % SETTINGS_SECTIONS.length;

    const nextSection = SETTINGS_SECTIONS[nextIndex]?.key ?? activeSection;
    onChange(nextSection);
    tabRefs.current[nextSection]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-orientation={compact ? 'horizontal' : 'vertical'}
      aria-label={t('settings.sections')}
      className={compact ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-1'}
    >
      {SETTINGS_SECTIONS.map(({ key, icon: Icon }, index) => {
        const selected = activeSection === key;
        const label = t(`settings.${key}`);
        const panelId = `settings-panel-${key}`;
        const tabId = `${idPrefix}-settings-tab-${key}`;

        return (
          <button
            key={key}
            ref={(node) => {
              tabRefs.current[key] = node;
            }}
            id={tabId}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            title={label}
            aria-label={label}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={
              inverted
                ? `group flex h-8 w-full items-center justify-start gap-2 rounded-[4px] border-transparent px-2 py-0 text-xs leading-6 transition-colors duration-[var(--motion-fast)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-on-aside/70 ${
                    selected
                      ? 'bg-on-aside/20 font-medium text-on-aside'
                      : 'bg-transparent text-on-aside/90 hover:bg-on-aside/5 hover:text-on-aside'
                  }`
                : `group flex min-h-10 items-center gap-2 rounded-[6px] border px-3 py-2 text-sm leading-6 transition-colors duration-[var(--motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
                    compact ? 'flex-1 justify-center' : 'w-full justify-start'
                  } ${
                    selected
                      ? 'border-transparent bg-[var(--planner-sidebar-active-bg)] font-medium text-ink'
                      : 'border-transparent bg-transparent text-ink-light hover:bg-[var(--planner-sidebar-hover-bg)] hover:text-ink'
                  }`
            }
          >
            <Icon size={16} strokeWidth={1.5} className="shrink-0" />
            <span className={compact ? 'sr-only' : 'leading-none'}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
