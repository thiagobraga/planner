import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clamp,
  formatColor,
  hsvToRgb,
  parseColor,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  hslToRgb,
} from '../../utils/color';
import type { ColorFormat } from '../../types/utils';
import { ColorPickerSliders } from './ColorPickerSliders';
import { PALETTE_COLORS, fetchSavedColors, apiAddSavedColor } from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import type { TranslationKey } from '../../i18n/catalogs';
import type { ChannelKey, ColorPickerPopoverProps, PickerState } from '../../types/ui';

const PANEL_WIDTH = 248;
const VIEWPORT_PADDING = 8;
const FALLBACK_COLOR = '#65788a';

export const SAVED_COLORS_QUERY_KEY = ['savedColors'] as const;

const CHANNELS: Record<ColorFormat, readonly ChannelKey[]> = {
  hex: [],
  rgb: ['r', 'g', 'b'],
  hsl: ['h', 's', 'l'],
};

const CHANNEL_MAX: Record<ChannelKey, number> = { r: 255, g: 255, b: 255, h: 360, s: 100, l: 100 };

const CHANNEL_LABEL: Record<ChannelKey, TranslationKey> = {
  r: 'colorPicker.red',
  g: 'colorPicker.green',
  b: 'colorPicker.blue',
  h: 'colorPicker.hue',
  s: 'colorPicker.saturation',
  l: 'colorPicker.lightness',
};

// One to three digits, nothing else: an empty field, a sign, a decimal point or
// a stray letter all leave the colour untouched rather than committing NaN.
const CHANNEL_INPUT = /^\d{1,3}$/;

function isInvalidChannelDraft(raw: string | undefined, key: ChannelKey): boolean {
  if (raw === undefined) return false;
  const trimmed = raw.trim();
  return !CHANNEL_INPUT.test(trimmed) || Number(trimmed) > CHANNEL_MAX[key];
}

function stateFromColor(value: string): PickerState {
  const parsed = parseColor(value) ?? parseColor(FALLBACK_COLOR)!;
  return { hsv: rgbToHsv(parsed.rgb), alpha: parsed.alpha };
}

export function ColorPickerPopover({ position, value, onCommit, onClose }: ColorPickerPopoverProps) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const panelRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<PickerState>(() => stateFromColor(value));
  const [format, setFormat] = useState<ColorFormat>(() =>
    parseColor(value) && !value.trim().startsWith('#')
      ? value.trim().toLowerCase().startsWith('hsl')
        ? 'hsl'
        : 'rgb'
      : 'hex',
  );
  const [draft, setDraft] = useState<string | null>(null);
  const [channelDrafts, setChannelDrafts] = useState<Partial<Record<ChannelKey, string>>>({});
  const [coords, setCoords] = useState({ top: position.y, left: position.x });

  const { data: savedColors = [] } = useQuery({
    queryKey: SAVED_COLORS_QUERY_KEY,
    queryFn: fetchSavedColors,
  });

  const rgb = useMemo(() => hsvToRgb(state.hsv), [state.hsv]);
  const hsl = useMemo(() => rgbToHsl(rgb), [rgb]);
  const current = useMemo(() => formatColor(rgb, state.alpha, format), [rgb, state.alpha, format]);
  const cssColor = useMemo(() => rgbToHex(rgb, state.alpha), [rgb, state.alpha]);

  const commit = useCallback(
    (color: string) => {
      onCommit(color);
      apiAddSavedColor(color)
        .then((colors) => qc.setQueryData<string[]>(SAVED_COLORS_QUERY_KEY, colors))
        .catch(() => qc.invalidateQueries({ queryKey: SAVED_COLORS_QUERY_KEY }));
    },
    [onCommit, qc],
  );

  const commitCurrent = useCallback(() => {
    commit(formatColor(hsvToRgb(state.hsv), state.alpha, format));
  }, [commit, state, format]);

  const applySwatch = useCallback(
    (color: string) => {
      const parsed = parseColor(color);
      if (!parsed) return;
      setState({ hsv: rgbToHsv(parsed.rgb), alpha: parsed.alpha });
      setDraft(null);
      commit(formatColor(parsed.rgb, parsed.alpha, format));
    },
    [commit, format],
  );

  // Viewport-aware positioning, mirroring ContextMenu so the picker never opens
  // off-screen when a row near the bottom edge is right-clicked.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const width = rect.width || PANEL_WIDTH;
    const height = rect.height || 0;

    let left = position.x;
    let top = position.y;
    if (left + width > vw - VIEWPORT_PADDING) left = vw - width - VIEWPORT_PADDING;
    if (top + height > vh - VIEWPORT_PADDING) top = vh - height - VIEWPORT_PADDING;

    setCoords({
      top: Math.max(VIEWPORT_PADDING, top),
      left: Math.max(VIEWPORT_PADDING, left),
    });
  }, [position]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const handlePanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      onClose();
    }
  };

  const commitText = () => {
    if (draft === null) return;
    const parsed = parseColor(draft);
    setDraft(null);
    if (!parsed) return;
    setState({ hsv: rgbToHsv(parsed.rgb), alpha: parsed.alpha });
    commit(formatColor(parsed.rgb, parsed.alpha, format));
  };

  const channelValue = (key: ChannelKey): number => {
    switch (key) {
      case 'r':
        return rgb.r;
      case 'g':
        return rgb.g;
      case 'b':
        return rgb.b;
      case 'h':
        return Math.round(hsl.h);
      case 's':
        return Math.round(hsl.s);
      case 'l':
        return Math.round(hsl.l);
    }
  };

  const commitChannel = (key: ChannelKey) => {
    const raw = channelDrafts[key];
    setChannelDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    // Tabbing through an untouched field must not re-commit the same colour and
    // push a duplicate onto the saved-colour list.
    if (raw === undefined) return;

    const trimmed = raw.trim();
    if (!CHANNEL_INPUT.test(trimmed)) return;

    const value = clamp(Number(trimmed), 0, CHANNEL_MAX[key]);
    const next =
      key === 'r' || key === 'g' || key === 'b'
        ? { ...rgb, [key]: value }
        : hslToRgb({
            h: key === 'h' ? value : hsl.h,
            s: key === 's' ? value : hsl.s,
            l: key === 'l' ? value : hsl.l,
          });

    const formatted = formatColor(next, state.alpha, format);
    if (formatted === current) return;

    setState({ hsv: rgbToHsv(next), alpha: state.alpha });
    commit(formatted);
  };

  const switchFormat = (next: ColorFormat) => {
    setDraft(null);
    setChannelDrafts({});
    setFormat(next);
  };

  const swatchRow = (colors: readonly string[], keyPrefix: string) =>
    colors.map((color, index) => (
      <button
        key={`${keyPrefix}-${color}-${index}`}
        type="button"
        aria-label={t('colorPicker.applySwatch', { color })}
        title={color}
        onClick={() => applySwatch(color)}
        className="color-picker__swatch h-4 w-4 shrink-0 rounded-full border border-border p-0 cursor-pointer"
        style={{ background: color }}
      />
    ));

  return createPortal(
    <div className="color-picker-root fixed inset-0 z-50 pointer-events-none">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label={t('colorPicker.title')}
        onKeyDown={handlePanelKeyDown}
        className="color-picker fixed z-50 pointer-events-auto flex flex-col gap-3 rounded-md border border-border p-3 shadow-medium"
        style={{ top: coords.top, left: coords.left, width: PANEL_WIDTH, outline: 'none', backgroundColor: 'var(--planner-overlay-bg)' }}
      >
        <ColorPickerSliders
          state={state}
          setState={setState}
          rgb={rgb}
          cssColor={cssColor}
          commitCurrent={commitCurrent}
          applySwatch={applySwatch}
        />

        <div className="color-picker__value flex items-center gap-2">
          <select
            aria-label={t('colorPicker.format')}
            value={format}
            onChange={(e) => switchFormat(e.target.value as ColorFormat)}
            className="h-6 shrink-0 cursor-pointer rounded-[4px] border border-border bg-transparent px-1 text-[11px] text-ink-light outline-none"
          >
            <option value="hex">{t('colorPicker.formatHex')}</option>
            <option value="rgb">{t('colorPicker.formatRgb')}</option>
            <option value="hsl">{t('colorPicker.formatHsl')}</option>
          </select>

          {format === 'hex' ? (
            <input
              aria-label={t('colorPicker.value')}
              value={draft ?? current}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitText}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitText();
                }
                if (e.key === 'Escape') setDraft(null);
              }}
              spellCheck={false}
              className="h-6 min-w-0 flex-1 border-0 border-b border-border-subtle bg-transparent px-0 text-[12px] text-ink outline-none"
            />
          ) : (
            <div className="color-picker__channels flex min-w-0 flex-1 items-center gap-2">
              {CHANNELS[format].map((key) => (
                <label
                  key={key}
                  className="color-picker__channel flex min-w-0 flex-1 items-center gap-1 border-b border-border-subtle"
                >
                  <span aria-hidden="true" className="text-[9px] uppercase text-ink-light">
                    {key}
                  </span>
                  <input
                    aria-label={t(CHANNEL_LABEL[key])}
                    aria-invalid={isInvalidChannelDraft(channelDrafts[key], key)}
                    inputMode="numeric"
                    maxLength={3}
                    value={channelDrafts[key] ?? String(channelValue(key))}
                    onChange={(e) =>
                      setChannelDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    onBlur={() => commitChannel(key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitChannel(key);
                      }
                      if (e.key === 'Escape') {
                        setChannelDrafts((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                      }
                    }}
                    spellCheck={false}
                    className="h-6 w-full min-w-0 border-0 bg-transparent px-0 text-center text-[12px] text-ink outline-none"
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="color-picker__section flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink-light">
            {t('colorPicker.savedColors')}
          </span>
          {savedColors.length === 0 ? (
            <span className="text-[11px] text-ink-light opacity-60">
              {t('colorPicker.noSavedColors')}
            </span>
          ) : (
            <div className="color-picker__saved flex flex-wrap gap-2">
              {swatchRow(savedColors, 'saved')}
            </div>
          )}
        </div>

        <div className="color-picker__section flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink-light">
            {t('colorPicker.appColors')}
          </span>
          <div className="color-picker__app-colors flex flex-wrap gap-2">
            {swatchRow(PALETTE_COLORS, 'app')}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
