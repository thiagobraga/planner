import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Toggle } from '../components/ui/Toggle';
import { fetchPreferences, apiUpdatePreferences, type Preferences } from '../api/client';
import { ensureFontLoaded, type FontOption } from '../utils/fontLoader';

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

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[8px] border border-border bg-[var(--planner-card-bg)] shadow-subtle !p-6">
      <div className="min-w-0">
        <h2 className="text-lg leading-6 font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-[13px] leading-6 text-ink-light opacity-60">{description}</p>
      </div>
      <div className="mt-7">{children}</div>
    </section>
  );
}

function selectedFrame(selected: boolean) {
  return selected
    ? 'border-ink bg-[var(--planner-control-bg-hover)] text-ink'
    : 'border-border bg-[var(--planner-control-bg)] text-ink hover:bg-[var(--planner-control-bg-hover)]';
}

function selectedBorder(selected: boolean) {
  return selected ? 'border-ink' : 'border-border group-hover:border-dot';
}

function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={`absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border ${selected ? 'border-ink bg-ink text-cream' : 'border-ink-light bg-transparent'
        }`}
      aria-hidden="true"
    >
      {selected && <Check size={12} strokeWidth={3} />}
    </span>
  );
}

export function SettingsPage() {
  const qc = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
  });

  const updateMutation = useMutation({
    mutationFn: (patch: Partial<Pick<Preferences, 'font' | 'showDots' | 'background' | 'smallCaps'>>) =>
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
      qc.setQueryData(['preferences'], data);
    },
  });

  const font = preferences?.font ?? 'lora';
  const showDots = preferences?.showDots ?? true;
  const background = preferences?.background ?? 'beige';
  const smallCaps = preferences?.smallCaps ?? false;
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

  if (isLoading) {
    return (
      <div className="max-w-5xl pb-24 text-ink">
        <h1 className="text-[18px] leading-6 font-semibold text-ink m-0">Settings</h1>
        <p className="text-sm leading-6 text-ink opacity-75 m-0">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl pb-24 text-ink">
      <header className="sticky-page-header">
        <h1 className="text-[18px] leading-6 font-semibold text-ink m-0">Settings</h1>
        <p className="text-[13px] leading-6 text-ink-light opacity-60 m-0">
          Customize your Planner experience. Changes are saved automatically.
        </p>
      </header>

      <div className="mt-12 flex flex-col gap-6">
        <SettingsCard
          title="Appearance"
          description="Adjust how Planner looks and feels."
        >
          <div className="flex flex-col gap-12">
            <div>
              <h3 className="text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium">Typography</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-8" role="radiogroup" aria-label="Font">
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
                      className={`relative flex w-full items-center justify-center rounded-[6px] border !px-4 !py-4 text-center transition-colors duration-[var(--motion-fast)] disabled:cursor-not-allowed disabled:opacity-50 ${selectedFrame(selected)}`}
                    >
                      <SelectionMark selected={selected} />
                      <span className={`${previewClass} leading-none`}>{label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4">
                <Toggle
                  checked={smallCaps}
                  onChange={handleSmallCapsChange}
                  disabled={disabled}
                  label={<span className="text-sm leading-6 text-ink">Small caps</span>}
                  className="[&_button]:!p-0"
                />
              </div>
            </div>

            <div>
              <h3 className="text-[10px] leading-6 tracking-[0.1em] uppercase text-ink-light font-medium">Background</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-8" role="radiogroup" aria-label="Background">
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
                        className={`relative block h-[60px] w-full rounded-[6px] border transition-colors duration-[var(--motion-fast)] ${selectedBorder(selected)} ${previewClass} ${showDots
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
              <div className="mt-4">
                <Toggle
                  checked={showDots}
                  onChange={handleDotsChange}
                  disabled={disabled}
                  label={<span className="text-sm leading-6 text-ink">Show background dots</span>}
                  className="[&_button]:!p-0"
                />
              </div>
            </div>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}
