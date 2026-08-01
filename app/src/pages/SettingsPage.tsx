import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { Check, Palette, Search, Settings2 } from 'lucide-react';
import { Toggle } from '../components/ui/Toggle';
import { Radio } from '../components/ui/Radio';
import { Input } from '../components/ui/Input';
import { fetchPreferences, apiUpdatePreferences, type Preferences } from '../api/client';
import { ensureFontLoaded, type FontOption } from '../utils/fontLoader';
import { getDetectedTimeZone } from '../utils/date';
import { useFloatingPosition } from '../hooks/useFloatingPosition';
import { useI18n } from '../i18n/I18nContext';

type SettingsSection = 'general' | 'appearance';

function isSettingsSection(value: string | undefined): value is SettingsSection {
  return value === 'general' || value === 'appearance';
}

const SETTINGS_SECTIONS: Array<{
  key: SettingsSection;
  icon: typeof Settings2;
}> = [
  { key: 'general', icon: Settings2 },
  { key: 'appearance', icon: Palette },
];

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

const BACKGROUND_OPTIONS: Array<{
  value: Preferences['background'];
  label: string;
  previewClass: string;
}> = [
  {
    value: 'beige',
    label: 'Beige',
    previewClass: 'bg-cream',
  },
  {
    value: 'white',
    label: 'White',
    previewClass: 'bg-white',
  },
];

const WEEK_START_OPTIONS: Array<{
  value: Preferences['weekStart'];
  label: string;
}> = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
];

function getBrowserSupportedTimeZones() {
  try {
    const supportedValuesOf = (Intl as typeof Intl & {
      supportedValuesOf?: (key: 'timeZone') => string[];
    }).supportedValuesOf;

    return typeof supportedValuesOf === 'function' ? supportedValuesOf.call(Intl, 'timeZone') : [];
  } catch {
    return [];
  }
}

function buildTimeZoneOptions(savedTimeZone: string | undefined, detectedTimeZone: string) {
  const preferred = ['UTC', detectedTimeZone, savedTimeZone].filter((zone): zone is string => Boolean(zone));
  const ordered = new Set<string>();

  for (const zone of preferred) {
    ordered.add(zone);
  }

  const browserZones = [...getBrowserSupportedTimeZones()].sort((a, b) => a.localeCompare(b));
  for (const zone of browserZones) {
    ordered.add(zone);
  }

  return [...ordered];
}

function SettingsCard({
  title,
  headingId,
  children,
}: {
  title: string;
  headingId: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="min-w-0 border-b border-[var(--planner-settings-separator)] pb-6">
        <h2 id={headingId} className="text-lg leading-6 font-semibold text-ink">
          {title}
        </h2>
      </div>
      <div className="pt-8">{children}</div>
    </section>
  );
}

function PreferenceToggle({
  checked,
  onChange,
  disabled,
  title,
  description,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  title: string;
  description: string;
  id: string;
}) {
  return (
    <Toggle
      id={id}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className="items-start"
      label={
        <span className="flex flex-col gap-0.5">
          <span className="text-sm leading-5 text-ink">{title}</span>
          <span className="text-[12px] leading-5 text-ink-light opacity-70">{description}</span>
        </span>
      }
    />
  );
}

function selectedFrame(selected: boolean) {
  return selected
    ? 'border-ink-light bg-[var(--planner-control-bg-hover)] text-ink'
    : 'border-border bg-[var(--planner-control-bg)] text-ink hover:bg-[var(--planner-control-bg-hover)]';
}

function selectedBorder(selected: boolean) {
  return selected ? 'border-ink-light' : 'border-border group-hover:border-dot';
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

function SettingsTabList({
  activeSection,
  compact,
  idPrefix,
  inverted = false,
  onChange,
}: {
  activeSection: SettingsSection;
  compact: boolean;
  idPrefix: string;
  inverted?: boolean;
  onChange: (section: SettingsSection) => void;
}) {
  const { t } = useI18n();
  const tabRefs = useRef<Record<SettingsSection, HTMLButtonElement | null>>({
    general: null,
    appearance: null,
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
      className={compact ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-1'}
    >
      {SETTINGS_SECTIONS.map(({ key, icon: Icon }, index) => {
        const selected = activeSection === key;
        const label = t(key === 'general' ? 'settings.general' : 'settings.appearance');
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
                ? `group flex h-8 w-full items-center justify-start gap-2 rounded-[4px] border-transparent px-2 py-0 text-xs leading-6 transition-colors duration-[var(--motion-fast)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-cream/70 ${
                    selected
                      ? 'bg-cream/20 font-medium text-cream'
                      : 'bg-transparent text-cream/90 hover:bg-cream/5 hover:text-cream'
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

export function SettingsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const timeZoneIdBase = useId().replace(/:/g, '');
  const timeZoneInputId = `settings-time-zone-${timeZoneIdBase}`;
  const panelHeadingId = `settings-panel-heading-${timeZoneIdBase}`;
  const detectedTimeZone = getDetectedTimeZone();
  const activeSection: SettingsSection = isSettingsSection(section) ? section : 'general';
  const [timeZoneDraft, setTimeZoneDraft] = useState(detectedTimeZone);
  const [isTimeZoneOpen, setIsTimeZoneOpen] = useState(false);
  const [timeZoneHighlight, setTimeZoneHighlight] = useState(0);
  const timeZoneTriggerRef = useRef<HTMLDivElement>(null);
  const timeZoneFloatingRef = useRef<HTMLDivElement>(null);
  const timeZoneListboxRef = useRef<HTMLUListElement>(null);

  const { top: timeZoneTop, left: timeZoneLeft } = useFloatingPosition(
    timeZoneTriggerRef,
    timeZoneFloatingRef,
    { placement: 'below', align: 'start' },
    isTimeZoneOpen,
  );

  useEffect(() => {
    if (!isSettingsSection(section)) {
      navigate('/settings/general', { replace: true });
    }
  }, [navigate, section]);

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
  });

  useEffect(() => {
    setTimeZoneDraft(preferences?.timeZone ?? detectedTimeZone);
  }, [detectedTimeZone, preferences?.timeZone]);

  const timeZoneOptions = useMemo(
    () => buildTimeZoneOptions(preferences?.timeZone, detectedTimeZone),
    [detectedTimeZone, preferences?.timeZone],
  );

  const filteredTimeZones = useMemo(() => {
    const query = timeZoneDraft.trim().toLowerCase();
    if (!query) return timeZoneOptions;
    return timeZoneOptions.filter((zone) => zone.toLowerCase().includes(query));
  }, [timeZoneDraft, timeZoneOptions]);

  const updateMutation = useMutation({
    mutationFn: (
      patch: Partial<
        Pick<
          Preferences,
          | 'font'
          | 'locale'
          | 'showDots'
          | 'background'
          | 'smallCaps'
          | 'timeZone'
          | 'weekStart'
          | 'hideCompletedTasks'
          | 'hideOldNotes'
        >
      >,
    ) =>
      apiUpdatePreferences(patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['preferences'] });
      const previous = qc.getQueryData<Preferences>(['preferences']);
      if (previous) {
        qc.setQueryData<Preferences>(['preferences'], { ...previous, ...patch });
      }
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        qc.setQueryData(['preferences'], context.previous);
      }
    },
    onSuccess: (data) => {
      qc.setQueryData<Preferences>(['preferences'], (prev) => (prev ? { ...prev, ...data } : data));
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['collection'] });
    },
  });

  const font = preferences?.font ?? 'lora';
  const locale = preferences?.locale ?? 'en';
  const showDots = preferences?.showDots ?? true;
  const background = preferences?.background ?? 'beige';
  const smallCaps = preferences?.smallCaps ?? false;
  const weekStart = preferences?.weekStart ?? 'sunday';
  const hideCompletedTasks = preferences?.hideCompletedTasks ?? false;
  const hideOldNotes = preferences?.hideOldNotes ?? false;
  const savedTimeZone = preferences?.timeZone ?? detectedTimeZone;
  const disabled = updateMutation.isPending;

  const handleFontChange = (nextFont: FontOption) => {
    ensureFontLoaded(nextFont);
    updateMutation.mutate({ font: nextFont });
  };

  const handleLocaleChange = (nextLocale: Preferences['locale']) => {
    updateMutation.mutate({ locale: nextLocale });
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

  const commitTimeZoneSelection = (nextTimeZone: string) => {
    setTimeZoneDraft(nextTimeZone);
    setIsTimeZoneOpen(false);
    if (nextTimeZone !== savedTimeZone) {
      updateMutation.mutate({ timeZone: nextTimeZone });
    }
  };

  const closeTimeZoneDropdown = () => {
    setIsTimeZoneOpen(false);
    if (!timeZoneOptions.includes(timeZoneDraft)) {
      setTimeZoneDraft(savedTimeZone);
    }
  };

  const handleTimeZoneInputChange = (nextDraft: string) => {
    setTimeZoneDraft(nextDraft);
    setIsTimeZoneOpen(true);
    setTimeZoneHighlight(0);
  };

  const handleTimeZoneFocus = () => {
    setIsTimeZoneOpen(true);
    const currentIndex = filteredTimeZones.indexOf(timeZoneDraft);
    setTimeZoneHighlight(currentIndex >= 0 ? currentIndex : 0);
  };

  const handleTimeZoneKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isTimeZoneOpen) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        event.preventDefault();
        setIsTimeZoneOpen(true);
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        closeTimeZoneDropdown();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setTimeZoneHighlight((prev) => Math.min(prev + 1, filteredTimeZones.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setTimeZoneHighlight((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredTimeZones[timeZoneHighlight]) {
          commitTimeZoneSelection(filteredTimeZones[timeZoneHighlight]);
        }
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (!isTimeZoneOpen) return;

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        timeZoneFloatingRef.current &&
        !timeZoneFloatingRef.current.contains(target) &&
        timeZoneTriggerRef.current &&
        !timeZoneTriggerRef.current.contains(target)
      ) {
        closeTimeZoneDropdown();
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimeZoneOpen, timeZoneDraft, timeZoneOptions, savedTimeZone]);

  useEffect(() => {
    if (!isTimeZoneOpen || !timeZoneListboxRef.current) return;
    const items = timeZoneListboxRef.current.querySelectorAll('[role="option"]');
    const highlighted = items[timeZoneHighlight] as HTMLElement | undefined;
    highlighted?.scrollIntoView?.({ block: 'nearest' });
  }, [isTimeZoneOpen, timeZoneHighlight]);

  const handleWeekStartChange = (nextWeekStart: Preferences['weekStart']) => {
    updateMutation.mutate({ weekStart: nextWeekStart });
  };

  const handleHideCompletedTasksChange = (nextHideCompletedTasks: boolean) => {
    updateMutation.mutate({ hideCompletedTasks: nextHideCompletedTasks });
  };

  const handleHideOldNotesChange = (nextHideOldNotes: boolean) => {
    updateMutation.mutate({ hideOldNotes: nextHideOldNotes });
  };

  const handleSectionChange = (nextSection: SettingsSection) => {
    navigate(`/settings/${nextSection}`);
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl pb-24 text-ink">
        <h1 className="text-[18px] leading-6 font-semibold text-ink m-0">{t('settings.title')}</h1>
        <p className="text-sm leading-6 text-ink opacity-75 m-0">{t('settings.loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-48px)] max-w-5xl flex-col text-ink">
      <header className="sticky-page-header">
        <h1 className="text-[18px] leading-6 font-semibold text-ink m-0">{t('settings.title')}</h1>
        <p className="text-[13px] leading-6 text-ink-light opacity-60 m-0">
          {t('settings.subtitle')}
        </p>
      </header>

      <section className="mt-6 flex flex-1 overflow-hidden rounded-[8px] border border-[var(--planner-settings-separator)] bg-[var(--planner-card-bg)] shadow-subtle">
        <div className="grid flex-1 gap-0 md:grid-cols-[minmax(0,1fr)_160px]">
          <div className="min-w-0 p-[var(--dot-grid)]">
            <div className="mb-6 md:hidden">
              <p className="px-1 pb-2 text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium">
                {t('settings.title').toUpperCase()}
              </p>
              <div className="rounded-[8px] border border-dot bg-[var(--planner-sidebar-bg)] p-3 shadow-subtle">
                <SettingsTabList activeSection={activeSection} compact idPrefix="mobile" onChange={handleSectionChange} />
              </div>
            </div>

            <div
              id={`settings-panel-${activeSection}`}
              role="tabpanel"
              aria-labelledby={panelHeadingId}
              className="min-w-0"
            >
              {activeSection === 'general' ? (
                <SettingsCard
                  title={t('settings.general')}
                  headingId={panelHeadingId}
                >
                  <div className="space-y-8">
                    <section className="space-y-3">
                      <div>
                        <h3 className="text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium">
                          {t('settings.language')}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('settings.language')}>
                        {([
                          ['en', t('settings.english')],
                          ['pt-BR', t('settings.portugueseBrazil')],
                        ] as const).map(([value, label]) => (
                          <Radio
                            key={value}
                            name="locale"
                            checked={locale === value}
                            onChange={() => handleLocaleChange(value)}
                            disabled={disabled}
                            label={label}
                            className={`w-full rounded-[6px] border px-3 py-3 transition-colors duration-[var(--motion-fast)] ${
                              locale === value
                                ? 'border-ink-light bg-[var(--planner-control-bg-hover)]'
                                : 'border-border bg-[var(--planner-control-bg)] hover:bg-[var(--planner-control-bg-hover)]'
                            }`}
                          />
                        ))}
                      </div>
                    </section>

                    <section className="space-y-3 border-t border-[var(--planner-settings-separator)] pt-8">
                      <div className="flex items-baseline justify-between gap-3">
                        <label
                          htmlFor={timeZoneInputId}
                          className="text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium"
                        >
                          {t('settings.timeZone')}
                        </label>
                        <p className="text-[11px] leading-5 text-ink-light opacity-70">
                          {t('settings.detected', { zone: detectedTimeZone })}
                        </p>
                      </div>
                      <div ref={timeZoneTriggerRef} className="relative">
                        <Input
                          id={timeZoneInputId}
                          icon={<Search size={16} />}
                          value={timeZoneDraft}
                          onChange={(event) => handleTimeZoneInputChange(event.target.value)}
                          onFocus={handleTimeZoneFocus}
                          onKeyDown={handleTimeZoneKeyDown}
                          onBlur={closeTimeZoneDropdown}
                          disabled={disabled}
                          placeholder={t('settings.searchTimeZones')}
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={isTimeZoneOpen}
                          aria-controls={`${timeZoneInputId}-listbox`}
                          aria-activedescendant={
                            isTimeZoneOpen && filteredTimeZones[timeZoneHighlight]
                              ? `${timeZoneInputId}-option-${timeZoneHighlight}`
                              : undefined
                          }
                          autoComplete="off"
                        />
                        {isTimeZoneOpen &&
                          createPortal(
                            <div
                              ref={timeZoneFloatingRef}
                              className="ui-custom-select-dropdown fixed z-50 p-1 bg-[var(--planner-card-bg)] border border-border rounded-md shadow-medium"
                              style={{
                                top: timeZoneTop,
                                left: timeZoneLeft,
                                width: timeZoneTriggerRef.current?.offsetWidth || 200,
                              }}
                            >
                              {filteredTimeZones.length > 0 ? (
                                <ul
                                  id={`${timeZoneInputId}-listbox`}
                                  role="listbox"
                                  ref={timeZoneListboxRef}
                                  className="max-h-[240px] overflow-y-auto"
                                  aria-label={t('settings.timeZone')}
                                >
                                  {filteredTimeZones.map((zone, index) => {
                                    const isSelected = zone === savedTimeZone;
                                    const isHighlighted = index === timeZoneHighlight;

                                    let itemClass = 'flex items-center h-9 px-2 rounded-[4px] text-sm cursor-pointer select-none ';
                                    if (isSelected) {
                                      itemClass += 'bg-dot/60 text-ink ';
                                    } else if (isHighlighted) {
                                      itemClass += 'bg-dot/40 text-ink ';
                                    } else {
                                      itemClass += 'text-ink hover:bg-dot/40 ';
                                    }

                                    return (
                                      <li
                                        key={zone}
                                        id={`${timeZoneInputId}-option-${index}`}
                                        role="option"
                                        aria-selected={isSelected}
                                        className={itemClass}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => commitTimeZoneSelection(zone)}
                                        onMouseEnter={() => setTimeZoneHighlight(index)}
                                      >
                                        {zone}
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <p className="px-2 py-2 text-sm text-ink-light">{t('settings.noTimeZonesFound')}</p>
                              )}
                            </div>,
                            timeZoneTriggerRef.current?.closest('.app-shell') ?? document.body,
                          )}
                      </div>
                    </section>

                    <section className="space-y-3 border-t border-[var(--planner-settings-separator)] pt-8">
                      <h3 className="text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium">
                        {t('settings.weekStartsOn')}
                      </h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {WEEK_START_OPTIONS.map(({ value }) => (
                          <Radio
                            key={value}
                            name="week-start"
                            checked={weekStart === value}
                            onChange={() => handleWeekStartChange(value)}
                            disabled={disabled}
                            label={t(value === 'sunday' ? 'settings.sunday' : 'settings.monday')}
                            className={`w-full rounded-[6px] border px-3 py-3 transition-colors duration-[var(--motion-fast)] ${
                              weekStart === value
                                ? 'border-ink-light bg-[var(--planner-control-bg-hover)]'
                                : 'border-border bg-[var(--planner-control-bg)] hover:bg-[var(--planner-control-bg-hover)]'
                            }`}
                          />
                        ))}
                      </div>
                    </section>

                    <section className="space-y-4 border-t border-[var(--planner-settings-separator)] pt-8">
                      <PreferenceToggle
                        id={`${timeZoneInputId}-hide-completed`}
                        checked={hideCompletedTasks}
                        onChange={handleHideCompletedTasksChange}
                        disabled={disabled}
                        title={t('settings.hideCompleted')}
                        description={t('settings.hideCompletedDescription')}
                      />

                      <PreferenceToggle
                        id={`${timeZoneInputId}-hide-old-notes`}
                        checked={hideOldNotes}
                        onChange={handleHideOldNotesChange}
                        disabled={disabled}
                        title={t('settings.hideOldNotes')}
                        description={t('settings.hideOldNotesDescription')}
                      />
                    </section>
                  </div>
                </SettingsCard>
              ) : (
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
                      <div className="grid max-w-[284px] grid-cols-2 gap-6" role="radiogroup" aria-label={t('settings.theme')}>
                        {BACKGROUND_OPTIONS.map(({ value, previewClass }) => {
                          const selected = background === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              disabled={disabled}
                              onClick={() => handleBackgroundChange(value)}
                              className="group flex flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span
                                className={`relative block h-[60px] w-full rounded-[6px] border transition-colors duration-[var(--motion-fast)] ${selectedBorder(selected)} ${previewClass} ${
                                  showDots
                                    ? '[background-image:radial-gradient(circle,var(--color-dot)_1px,transparent_1px)] [background-size:var(--dot-grid)_var(--dot-grid)] [background-position:calc(var(--dot-grid)/2)_calc(var(--dot-grid)/2)]'
                                    : ''
                                }`}
                              >
                                <SelectionMark selected={selected} />
                              </span>
                              <span className="text-base leading-6 text-ink opacity-80">
                                {t(value === 'beige' ? 'settings.beige' : 'settings.white')}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <Toggle
                        checked={showDots}
                        onChange={handleDotsChange}
                        disabled={disabled}
                        label={<span className="text-sm leading-6 text-ink">{t('settings.showDots')}</span>}
                        className="[&_button]:!p-0"
                      />
                    </section>
                  </div>
                </SettingsCard>
              )}
            </div>
          </div>

          <aside className="hidden border-l border-black/10 bg-settings-aside p-4 font-journal text-cream md:block">
            <SettingsTabList
              activeSection={activeSection}
              compact={false}
              idPrefix="desktop"
              inverted
              onChange={handleSectionChange}
            />
          </aside>
        </div>
      </section>
    </div>
  );
}
