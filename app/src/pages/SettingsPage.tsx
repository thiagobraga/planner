import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPreferences, apiUpdatePreferences } from '../api/client';
import { ensureFontLoaded } from '../utils/fontLoader';

export function SettingsPage() {
  const qc = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
  });

  const updateMutation = useMutation({
    mutationFn: (patch: { font: 'lora' | 'patrick' }) => apiUpdatePreferences(patch),
    onSuccess: (data) => {
      qc.setQueryData(['preferences'], data);
    },
  });

  const handleFontChange = (font: 'lora' | 'patrick') => {
    ensureFontLoaded(font);
    updateMutation.mutate({ font });
  };

  if (isLoading) {
    return (
      <div className="max-w-162">
        <h1 className="text-[18px] leading-6 font-semibold text-ink m-0">Settings</h1>
        <p className="text-[13px] leading-6 text-ink-light opacity-60 m-0">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-162">
      <h1 className="text-[18px] leading-6 font-semibold text-ink m-0">Settings</h1>
      <p className="text-[13px] leading-6 text-ink-light opacity-60 m-0">Configure your preferences</p>
      <div className="h-6" />

      <div className="pb-6">
        <h2 className="text-sm font-semibold text-ink mb-4">Font</h2>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="font"
              value="lora"
              checked={preferences?.font === 'lora'}
              onChange={() => handleFontChange('lora')}
              disabled={updateMutation.isPending}
              className="w-4 h-4 cursor-pointer"
            />
            <span className="text-sm text-ink">Lora (default)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="font"
              value="patrick"
              checked={preferences?.font === 'patrick'}
              onChange={() => handleFontChange('patrick')}
              disabled={updateMutation.isPending}
              className="w-4 h-4 cursor-pointer"
            />
            <span className={`text-sm text-ink ${preferences?.font === 'patrick' ? 'font-patrick' : ''}`}>Patrick Hand (handwritten)</span>
          </label>
        </div>
        {updateMutation.error && (
          <p className="text-[13px] text-accent mt-2">Error saving settings</p>
        )}
      </div>
    </div>
  );
}
