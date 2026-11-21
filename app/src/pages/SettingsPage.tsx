import { useEffect, useLayoutEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { Radio } from '../components/ui/Radio';
import { fetchPreferences } from '../api/client';
import { useUpdatePreferences } from '../hooks/useUpdatePreferences';
import { NavStyleField } from '../components/settings/NavStyleField';
import { SettingsCard, PreferenceToggle } from '../components/settings/SettingsFields';
import { SettingsTabList } from '../components/settings/SettingsTabList';
import { SettingsAppearance } from '../components/settings/SettingsAppearance';
import { SettingsTimeZone, buildTimeZoneOptions } from '../components/settings/SettingsTimeZone';
import { DATE_FORMAT_OPTIONS, WEEK_START_OPTIONS } from '../components/settings/settingsOptions';
import { getDetectedTimeZone } from '../utils/date';
import { useFloatingPosition } from '../hooks/useFloatingPosition';
import { useI18n } from '../i18n/I18nContext';
import { ApiTokensSection } from '../components/settings/ApiTokensSection';
import { ConnectedAppsSection } from '../components/settings/ConnectedAppsSection';
import { AccountDataSection } from '../components/settings/AccountDataSection';
import type { Preferences } from '../types/api';
import type { SettingsSection } from '../types/settings';

function isSettingsSection(value: string | undefined): value is SettingsSection {
  return value === 'general' || value === 'appearance' || value === 'integrations';
}

export function SettingsPage() {
  const { t } = useI18n();
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
  const [timeZoneTriggerWidth, setTimeZoneTriggerWidth] = useState(200);
  const timeZoneTriggerRef = useRef<HTMLDivElement>(null);
  const timeZoneFloatingRef = useRef<HTMLDivElement>(null);
  const timeZoneListboxRef = useRef<HTMLUListElement>(null);

  const { top: timeZoneTop, left: timeZoneLeft } = useFloatingPosition(
    timeZoneTriggerRef,
    timeZoneFloatingRef,
    { placement: 'below', align: 'start' },
    isTimeZoneOpen,
  );

  useLayoutEffect(() => {
    setTimeZoneTriggerWidth(timeZoneTriggerRef.current?.offsetWidth ?? 200);
  }, [isTimeZoneOpen]);

  useEffect(() => {
    if (!isSettingsSection(section)) {
      navigate('/settings/general', { replace: true });
    }
  }, [navigate, section]);

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
  });

  useLayoutEffect(() => {
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

  const updateMutation = useUpdatePreferences();

  const locale = preferences?.locale ?? 'en';
  const weekStart = preferences?.weekStart ?? 'sunday';
  const hideCompletedTasks = preferences?.hideCompletedTasks ?? false;
  const showNotes = preferences?.showNotes ?? true;
  const agentChangeNotices = preferences?.agentChangeNotices ?? false;
  const dateFormat = preferences?.dateFormat ?? 'MMM DD ddd';
  const savedTimeZone = preferences?.timeZone ?? detectedTimeZone;
  const disabled = updateMutation.isPending;

  const handleDateFormatChange = (nextFormat: string) => {
    updateMutation.mutate({ dateFormat: nextFormat });
  };

  const handleLocaleChange = (nextLocale: Preferences['locale']) => {
    updateMutation.mutate({ locale: nextLocale });
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

  const handleShowNotesChange = (nextShowNotes: boolean) => {
    updateMutation.mutate({ showNotes: nextShowNotes });
  };

  const handleSectionChange = (nextSection: SettingsSection) => {
    navigate(`/settings/${nextSection}`);
  };

  if (isLoading) {
    return (
      <div className="pb-24 text-ink">
        <PageHeader title={t('settings.title')} />
        <p className="text-sm leading-6 text-ink opacity-75 m-0">{t('settings.loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-48px)] flex-col text-ink">
      <header className="page-header-copy sticky-page-header shrink-0">
        <div className="page-header-copy-text w-full !pr-0">
          <h1 className="m-0 h-6 p-0 text-[18px] leading-6 font-semibold text-ink">{t('settings.title')}</h1>
          <p className="page-header-subtitle m-0 min-h-6 p-0 !pr-0 text-[13px] leading-6 text-ink-light opacity-60 !whitespace-normal !overflow-visible">
            {t('settings.subtitle')}
          </p>
        </div>
      </header>

      <section className="mt-6 flex flex-1 overflow-hidden rounded-[8px] border border-[var(--planner-settings-separator)] bg-[var(--planner-card-bg)] shadow-subtle">
        <div className="grid flex-1 gap-0 md:grid-cols-[minmax(0,1fr)_160px]">
          <div className="min-w-0 p-[var(--dot-grid)]">
            <div className="mb-6 md:hidden">
              <p className="px-1 pb-2 text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium">
                {t('settings.title').toUpperCase()}
              </p>
              <div className="rounded-[8px] border border-border-subtle bg-[var(--planner-sidebar-bg)] p-3 shadow-subtle">
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
                    <NavStyleField
                      value={preferences?.navStyle ?? 'icon-left'}
                      onChange={(navStyle) => updateMutation.mutate({ navStyle })}
                      disabled={disabled}
                      error={updateMutation.isError && updateMutation.variables?.navStyle !== undefined}
                    />
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

                    <SettingsTimeZone
                      timeZoneInputId={timeZoneInputId}
                      detectedTimeZone={detectedTimeZone}
                      savedTimeZone={savedTimeZone}
                      timeZoneDraft={timeZoneDraft}
                      timeZoneHighlight={timeZoneHighlight}
                      timeZoneTriggerWidth={timeZoneTriggerWidth}
                      timeZoneTriggerRef={timeZoneTriggerRef}
                      timeZoneFloatingRef={timeZoneFloatingRef}
                      timeZoneListboxRef={timeZoneListboxRef}
                      timeZoneTop={timeZoneTop}
                      timeZoneLeft={timeZoneLeft}
                      disabled={disabled}
                      isTimeZoneOpen={isTimeZoneOpen}
                      filteredTimeZones={filteredTimeZones}
                      handleTimeZoneInputChange={handleTimeZoneInputChange}
                      handleTimeZoneFocus={handleTimeZoneFocus}
                      handleTimeZoneKeyDown={handleTimeZoneKeyDown}
                      closeTimeZoneDropdown={closeTimeZoneDropdown}
                      commitTimeZoneSelection={commitTimeZoneSelection}
                      setTimeZoneHighlight={setTimeZoneHighlight}
                    />

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

                    <section className="space-y-3 border-t border-[var(--planner-settings-separator)] pt-8">
                      <h3 className="text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium">
                        Date display
                      </h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {DATE_FORMAT_OPTIONS.map(({ value, label, example }) => (
                          <Radio
                            key={value}
                            name="date-format"
                            checked={dateFormat === value}
                            onChange={() => handleDateFormatChange(value)}
                            disabled={disabled}
                            label={
                              <span className="flex flex-col">
                                <span>{example}</span>
                                <span className="text-[11px] text-ink-light opacity-70">{label}</span>
                              </span>
                            }
                            className={`w-full rounded-[6px] border px-3 py-3 transition-colors duration-[var(--motion-fast)] ${
                              dateFormat === value
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
                        id={`${timeZoneInputId}-show-notes`}
                        checked={showNotes}
                        onChange={handleShowNotesChange}
                        disabled={disabled}
                        title={t('settings.showNotes')}
                        description={t('settings.showNotesDescription')}
                      />
                    </section>

                    <AccountDataSection />
                  </div>
                </SettingsCard>
              ) : activeSection === 'integrations' ? (
                <SettingsCard
                  title={t('settings.integrations')}
                  headingId={panelHeadingId}
                >
                  <div className="space-y-6">
                    <PreferenceToggle
                      id={`${timeZoneInputId}-agent-notices`}
                      checked={agentChangeNotices}
                      onChange={(next) => updateMutation.mutate({ agentChangeNotices: next })}
                      disabled={disabled}
                      title={t('settings.agentNotices')}
                      description={t('settings.agentNoticesDescription')}
                    />
                    <ConnectedAppsSection />
                    <ApiTokensSection />
                  </div>
                </SettingsCard>
              ) : (
                <SettingsAppearance preferences={preferences} updateMutation={updateMutation} panelHeadingId={panelHeadingId} />
              )}
            </div>
          </div>

          <aside className="hidden border-l border-border/10 bg-settings-aside p-4 font-journal text-on-aside md:block">
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
