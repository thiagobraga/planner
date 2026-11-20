import { Toggle } from '../ui/Toggle';
import type { PreferenceToggleProps, SettingsCardProps } from '../../types/settings';

export function SettingsCard({
  title,
  headingId,
  children,
}: SettingsCardProps) {
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

export function PreferenceToggle({
  checked,
  onChange,
  disabled,
  title,
  description,
  id,
}: PreferenceToggleProps) {
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

