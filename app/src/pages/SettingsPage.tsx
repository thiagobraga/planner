import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { Check, Palette, Search, Settings2 } from 'lucide-react';
import { Toggle } from '../components/ui/Toggle';
import { Radio } from '../components/ui/Radio';
import { Input } from '../components/ui/Input';
import { fetchPreferences, apiUpdatePreferences, type Preferences } from '../api/client';
import { ensureFontLoaded, type FontOption } from '../utils/fontLoader';

type SettingsSection = 'general' | 'appearance';

function isSettingsSection(value: string | undefined): value is SettingsSection {
  return value === 'general' || value === 'appearance';
}

const SETTINGS_SECTIONS: Array<{
  key: SettingsSection;
  label: string;
  icon: typeof Settings2;
}> = [
  { key: 'general', label: 'General', icon: Settings2 },
  { key: 'appearance', label: 'Appearance', icon: Palette },
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

function getDetectedTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

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
  description,
  headingId,
  children,
}: {
  title: string;
  description: string;
  headingId: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="min-w-0 border-b border-[var(--planner-settings-separator)] pb-6">
        <h2 id={headingId} className="text-lg leading-6 font-semibold text-ink">
          {title}
        </h2>
        <p className="mt-1 text-[13px] leading-6 text-ink-light opacity-60">{description}</p>
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
          <span className="text-sm leading-6 text-ink">{title}</span>
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
      aria-label="Settings sections"
      className={compact ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-1'}
    >
      {SETTINGS_SECTIONS.map(({ key, label, icon: Icon }, index) => {
        const selected = activeSection === key;
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
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const timeZoneIdBase = useId().replace(/:/g, '');
  const timeZoneInputId = `settings-time-zone-${timeZoneIdBase}`;
  const timeZoneHintId = `settings-time-zone-hint-${timeZoneIdBase}`;
  const panelHeadingId = `settings-panel-heading-${timeZoneIdBase}`;
  const detectedTimeZone = getDetectedTimeZone();
  const activeSection: SettingsSection = isSettingsSection(section) ? section : 'general';
  const [timeZoneDraft, setTimeZoneDraft] = useState(detectedTimeZone);

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

  const handleDotsChange = (nextShowDots: boolean) => {
    updateMutation.mutate({ showDots: nextShowDots });
  };

  const handleBackgroundChange = (nextBackground: Preferences['background']) => {
    updateMutation.mutate({ background: nextBackground });
  };

  const handleSmallCapsChange = (next: boolean) => {
    updateMutation.mutate({ smallCaps: next });
  };

  const handleTimeZoneChange = (nextTimeZone: string) => {
    setTimeZoneDraft(nextTimeZone);
    if (nextTimeZone !== savedTimeZone && timeZoneOptions.includes(nextTimeZone)) {
      updateMutation.mutate({ timeZone: nextTimeZone });
    }
  };

  const handleTimeZoneBlur = () => {
    if (!timeZoneOptions.includes(timeZoneDraft)) {
      setTimeZoneDraft(savedTimeZone);
    }
  };

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
        <h1 className="text-[18px] leading-6 font-semibold text-ink m-0">Settings</h1>
        <p className="text-sm leading-6 text-ink opacity-75 m-0">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-48px)] max-w-5xl flex-col text-ink">
      <header className="sticky-page-header">
        <h1 className="text-[18px] leading-6 font-semibold text-ink m-0">Settings</h1>
        <p className="text-[13px] leading-6 text-ink-light opacity-60 m-0">
          Customize your Planner experience. Changes are saved automatically.
        </p>
      </header>

      <section className="mt-6 flex flex-1 overflow-hidden rounded-[8px] border border-[var(--planner-settings-separator)] bg-[var(--planner-card-bg)] shadow-subtle">
        <div className="grid flex-1 gap-0 md:grid-cols-[minmax(0,1fr)_160px]">
          <div className="min-w-0 p-[var(--dot-grid)]">
            <div className="mb-6 md:hidden">
              <p className="px-1 pb-2 text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium">
                SETTINGS
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
                  title="General"
                  description="Set how Planner handles dates and your calendar."
                  headingId={panelHeadingId}
                >
                  <div className="space-y-8">
                    <section className="space-y-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <label
                          htmlFor={timeZoneInputId}
                          className="text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium"
                        >
                          Time zone
                        </label>
                        <p className="text-[11px] leading-5 text-ink-light opacity-70">
                          Detected: {detectedTimeZone}
                        </p>
                      </div>
                      <Input
                        id={timeZoneInputId}
                        icon={<Search size={16} />}
                        value={timeZoneDraft}
                        onChange={(event) => handleTimeZoneChange(event.target.value)}
                        onBlur={handleTimeZoneBlur}
                        disabled={disabled}
                        placeholder="Search time zones"
                        list={`${timeZoneInputId}-options`}
                        aria-describedby={timeZoneHintId}
                        autoComplete="off"
                      />
                      <p id={timeZoneHintId} className="text-xs leading-5 text-ink-light">
                        UTC, your browser zone, and the saved value remain available as suggestions.
                      </p>
                      <datalist id={`${timeZoneInputId}-options`}>
                        {filteredTimeZones.map((zone) => (
                          <option key={zone} value={zone} />
                        ))}
                      </datalist>
                    </section>

                    <section className="space-y-3 border-t border-[var(--planner-settings-separator)] pt-8">
                      <h3 className="text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium">
                        Week starts on
                      </h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {WEEK_START_OPTIONS.map(({ value, label }) => (
                          <Radio
                            key={value}
                            name="week-start"
                            checked={weekStart === value}
                            onChange={() => handleWeekStartChange(value)}
                            disabled={disabled}
                            label={label}
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
                        title="Hide completed tasks"
                        description="Completed rows disappear from Daily, Inbox, and Collection views."
                      />

                      <PreferenceToggle
                        id={`${timeZoneInputId}-hide-old-notes`}
                        checked={hideOldNotes}
                        onChange={handleHideOldNotesChange}
                        disabled={disabled}
                        title="Hide old notes"
                        description="Notes dated before your local today disappear from Daily, Inbox, and Collection views."
                      />
                    </section>
                  </div>
                </SettingsCard>
              ) : (
                <SettingsCard
                  title="Appearance"
                  description="Adjust how Planner looks and feels."
                  headingId={panelHeadingId}
                >
                  <div className="flex flex-col gap-10">
                    <section className="space-y-4">
                      <h3 className="text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium">
                        Typography
                      </h3>
                      <div className="grid max-w-[420px] grid-cols-1 gap-3" role="radiogroup" aria-label="Font">
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
                        label={<span className="text-sm leading-6 text-ink">Small caps</span>}
                        className="[&_button]:!p-0"
                      />
                    </section>

                    <section className="space-y-4 border-t border-[var(--planner-settings-separator)] pt-8">
                      <h3 className="text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium">
                        Theme
                      </h3>
                      <div className="grid max-w-[284px] grid-cols-2 gap-6" role="radiogroup" aria-label="Theme">
                        {BACKGROUND_OPTIONS.map(({ value, label, previewClass }) => {
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
                              <span className="text-base leading-6 text-ink opacity-80">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <Toggle
                        checked={showDots}
                        onChange={handleDotsChange}
                        disabled={disabled}
                        label={<span className="text-sm leading-6 text-ink">Show background dots</span>}
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
