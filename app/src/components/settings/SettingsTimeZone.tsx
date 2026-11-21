import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { Input } from '../ui/Input';
import { useI18n } from '../../i18n/I18nContext';
import type { SettingsTimeZoneProps } from '../../types/settings';

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

export function buildTimeZoneOptions(savedTimeZone: string | undefined, detectedTimeZone: string) {
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

export function SettingsTimeZone({
  timeZoneInputId,
  detectedTimeZone,
  savedTimeZone,
  timeZoneDraft,
  timeZoneHighlight,
  timeZoneTriggerWidth,
  timeZoneTriggerRef,
  timeZoneFloatingRef,
  timeZoneListboxRef,
  timeZoneTop,
  timeZoneLeft,
  disabled,
  isTimeZoneOpen,
  filteredTimeZones,
  handleTimeZoneInputChange,
  handleTimeZoneFocus,
  handleTimeZoneKeyDown,
  closeTimeZoneDropdown,
  commitTimeZoneSelection,
  setTimeZoneHighlight,
}: SettingsTimeZoneProps) {
  const { t } = useI18n();
  return (
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
                width: timeZoneTriggerWidth,
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
                      itemClass += 'bg-border-subtle/60 text-ink ';
                    } else if (isHighlighted) {
                      itemClass += 'bg-border-subtle/40 text-ink ';
                    } else {
                      itemClass += 'text-ink hover:bg-border-subtle/40 ';
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
            document.body,
          )}
      </div>
    </section>
  );
}
