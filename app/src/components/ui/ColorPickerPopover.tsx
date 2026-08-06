import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pipette } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clamp,
  formatColor,
  hsvToRgb,
  isLightColor,
  parseColor,
  rgbToHex,
  rgbToHsv,
  type ColorFormat,
  type Hsv,
} from '../../utils/color';
import { PALETTE_COLORS, fetchSavedColors, apiAddSavedColor } from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';

const PANEL_WIDTH = 248;
const VIEWPORT_PADDING = 8;
const FALLBACK_COLOR = '#65788a';

export const SAVED_COLORS_QUERY_KEY = ['savedColors'] as const;

export interface ColorPickerPopoverProps {
  position: { x: number; y: number };
  value: string;
  onCommit: (color: string) => void;
  onClose: () => void;
}

interface PickerState {
  hsv: Hsv;
  alpha: number;
}

function stateFromColor(value: string): PickerState {
  const parsed = parseColor(value) ?? parseColor(FALLBACK_COLOR)!;
  return { hsv: rgbToHsv(parsed.rgb), alpha: parsed.alpha };
}

function ratioFromPointer(
  el: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const rect = el.getBoundingClientRect();
  // jsdom and a not-yet-laid-out panel both report a zero-sized rect; dividing
  // by it would push the thumb to NaN.
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    x: clamp((clientX - rect.left) / rect.width, 0, 1),
    y: clamp((clientY - rect.top) / rect.height, 0, 1),
  };
}

export function ColorPickerPopover({ position, value, onCommit, onClose }: ColorPickerPopoverProps) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const squareRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<PickerState>(() => stateFromColor(value));
  const [format, setFormat] = useState<ColorFormat>(() =>
    parseColor(value) && !value.trim().startsWith('#')
      ? value.trim().toLowerCase().startsWith('hsl')
        ? 'hsl'
        : 'rgb'
      : 'hex',
  );
  const [draft, setDraft] = useState<string | null>(null);
  const [coords, setCoords] = useState({ top: position.y, left: position.x });

  const { data: savedColors = [] } = useQuery({
    queryKey: SAVED_COLORS_QUERY_KEY,
    queryFn: fetchSavedColors,
  });

  const rgb = useMemo(() => hsvToRgb(state.hsv), [state.hsv]);
  const current = useMemo(() => formatColor(rgb, state.alpha, format), [rgb, state.alpha, format]);
  const cssColor = useMemo(() => rgbToHex(rgb, state.alpha), [rgb, state.alpha]);
  const hueColor = `hsl(${Math.round(state.hsv.h)}, 100%, 50%)`;

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

  const handleSquarePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const ratio = squareRef.current && ratioFromPointer(squareRef.current, e.clientX, e.clientY);
    if (!ratio) return;
    setState((prev) => ({ ...prev, hsv: { ...prev.hsv, s: ratio.x * 100, v: (1 - ratio.y) * 100 } }));
  };

  const handleHuePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const ratio = hueRef.current && ratioFromPointer(hueRef.current, e.clientX, e.clientY);
    if (!ratio) return;
    setState((prev) => ({ ...prev, hsv: { ...prev.hsv, h: ratio.x * 360 } }));
  };

  const handleAlphaPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const ratio = alphaRef.current && ratioFromPointer(alphaRef.current, e.clientX, e.clientY);
    if (!ratio) return;
    setState((prev) => ({ ...prev, alpha: ratio.x }));
  };

  function beginDrag(
    e: React.PointerEvent<HTMLDivElement>,
    move: (e: React.PointerEvent<HTMLDivElement>) => void,
  ) {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    move(e);
  }

  function continueDrag(
    e: React.PointerEvent<HTMLDivElement>,
    move: (e: React.PointerEvent<HTMLDivElement>) => void,
  ) {
    if (e.buttons === 0) return;
    move(e);
  }

  // Arrow keys nudge; the value is only committed once the key is released, so
  // holding an arrow produces one mutation rather than one per repeat.
  const nudge = (e: React.KeyboardEvent, apply: (delta: number, axis: 'x' | 'y') => void) => {
    const step = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case 'ArrowLeft':
        apply(-step, 'x');
        break;
      case 'ArrowRight':
        apply(step, 'x');
        break;
      case 'ArrowUp':
        apply(step, 'y');
        break;
      case 'ArrowDown':
        apply(-step, 'y');
        break;
      default:
        return;
    }
    e.preventDefault();
  };

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

  const supportsEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

  const pickWithEyeDropper = () => {
    const Ctor = window.EyeDropper;
    if (!Ctor) return;
    new Ctor()
      .open()
      .then((result) => applySwatch(result.sRGBHex))
      .catch(() => {
        /* the user dismissed the picker */
      });
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
        className="color-picker fixed z-50 pointer-events-auto flex flex-col gap-3 rounded-md border border-border bg-cream p-3 font-journal shadow-medium"
        style={{ top: coords.top, left: coords.left, width: PANEL_WIDTH, outline: 'none' }}
      >
        <div
          ref={squareRef}
          role="slider"
          tabIndex={0}
          aria-label={t('colorPicker.saturation')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(state.hsv.s)}
          aria-valuetext={`${Math.round(state.hsv.s)}%, ${Math.round(state.hsv.v)}%`}
          onPointerDown={(e) => beginDrag(e, handleSquarePointer)}
          onPointerMove={(e) => continueDrag(e, handleSquarePointer)}
          onPointerUp={commitCurrent}
          onKeyDown={(e) =>
            nudge(e, (delta, axis) =>
              setState((prev) => ({
                ...prev,
                hsv: {
                  ...prev.hsv,
                  s: axis === 'x' ? clamp(prev.hsv.s + delta, 0, 100) : prev.hsv.s,
                  v: axis === 'y' ? clamp(prev.hsv.v + delta, 0, 100) : prev.hsv.v,
                },
              })),
            )
          }
          onKeyUp={(e) => {
            if (e.key.startsWith('Arrow')) commitCurrent();
          }}
          className="color-picker__square relative h-[132px] w-full cursor-crosshair rounded-[4px] border border-border touch-none"
          style={{
            background: `linear-gradient(to top, #2c2c2c, rgba(44,44,44,0)), linear-gradient(to right, #f5f0e8, ${hueColor})`,
          }}
        >
          <span
            aria-hidden="true"
            className="color-picker__thumb absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{
              left: `${state.hsv.s}%`,
              top: `${100 - state.hsv.v}%`,
              background: cssColor,
              borderColor: isLightColor(rgb) ? '#44443d' : '#f5f0e8',
            }}
          />
        </div>

        <div className="color-picker__controls flex items-center gap-2">
          {supportsEyeDropper && (
            <button
              type="button"
              aria-label={t('colorPicker.eyedropper')}
              title={t('colorPicker.eyedropper')}
              onClick={pickWithEyeDropper}
              className="color-picker__eyedropper flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-0 bg-transparent p-0 text-ink-light hover:text-ink"
            >
              <Pipette size={14} strokeWidth={1.5} />
            </button>
          )}
          <span
            aria-hidden="true"
            className="color-picker__preview h-6 w-6 shrink-0 rounded-full border border-border"
            style={{ background: cssColor }}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div
              ref={hueRef}
              role="slider"
              tabIndex={0}
              aria-label={t('colorPicker.hue')}
              aria-valuemin={0}
              aria-valuemax={360}
              aria-valuenow={Math.round(state.hsv.h)}
              onPointerDown={(e) => beginDrag(e, handleHuePointer)}
              onPointerMove={(e) => continueDrag(e, handleHuePointer)}
              onPointerUp={commitCurrent}
              onKeyDown={(e) =>
                nudge(e, (delta) =>
                  setState((prev) => ({
                    ...prev,
                    hsv: { ...prev.hsv, h: clamp(prev.hsv.h + delta, 0, 360) },
                  })),
                )
              }
              onKeyUp={(e) => {
                if (e.key.startsWith('Arrow')) commitCurrent();
              }}
              className="color-picker__hue relative h-2 w-full cursor-pointer rounded-full touch-none"
              style={{
                background:
                  'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
              }}
            >
              <span
                aria-hidden="true"
                className="color-picker__thumb absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cream"
                style={{ left: `${(state.hsv.h / 360) * 100}%`, background: hueColor }}
              />
            </div>

            <div
              ref={alphaRef}
              role="slider"
              tabIndex={0}
              aria-label={t('colorPicker.alpha')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(state.alpha * 100)}
              onPointerDown={(e) => beginDrag(e, handleAlphaPointer)}
              onPointerMove={(e) => continueDrag(e, handleAlphaPointer)}
              onPointerUp={commitCurrent}
              onKeyDown={(e) =>
                nudge(e, (delta) =>
                  setState((prev) => ({ ...prev, alpha: clamp(prev.alpha + delta / 100, 0, 1) })),
                )
              }
              onKeyUp={(e) => {
                if (e.key.startsWith('Arrow')) commitCurrent();
              }}
              className="color-picker__alpha relative h-2 w-full cursor-pointer rounded-full touch-none"
              style={{
                backgroundImage: `linear-gradient(to right, ${rgbToHex(rgb, 0)}, ${rgbToHex(rgb, 1)}), repeating-conic-gradient(#d4cfc7 0% 25%, #f5f0e8 0% 50%)`,
                backgroundSize: '100% 100%, 8px 8px',
              }}
            >
              <span
                aria-hidden="true"
                className="color-picker__thumb absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cream"
                style={{ left: `${state.alpha * 100}%`, background: cssColor }}
              />
            </div>
          </div>
        </div>

        <div className="color-picker__value flex items-center gap-2">
          <select
            aria-label={t('colorPicker.format')}
            value={format}
            onChange={(e) => {
              setDraft(null);
              setFormat(e.target.value as ColorFormat);
            }}
            className="h-6 shrink-0 cursor-pointer rounded-[4px] border border-border bg-transparent px-1 text-[11px] text-ink-light outline-none"
          >
            <option value="hex">{t('colorPicker.formatHex')}</option>
            <option value="rgb">{t('colorPicker.formatRgb')}</option>
            <option value="hsl">{t('colorPicker.formatHsl')}</option>
          </select>
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
            className="h-6 min-w-0 flex-1 border-0 border-b border-dot bg-transparent px-0 text-[12px] text-ink outline-none"
          />
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
