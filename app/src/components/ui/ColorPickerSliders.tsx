import { useRef } from 'react';
import { Pipette } from 'lucide-react';
import { clamp, isLightColor, rgbToHex } from '../../utils/color';
import { useI18n } from '../../i18n/I18nContext';
import type { ColorPickerSlidersProps } from '../../types/colorPicker';

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

export function ColorPickerSliders({ state, setState, rgb, cssColor, commitCurrent, applySwatch }: ColorPickerSlidersProps) {
  const { t } = useI18n();
  const squareRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);
  const hueColor = `hsl(${Math.round(state.hsv.h)}, 100%, 50%)`;

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

  return (
    <>
        <div
          ref={squareRef}
          role="slider"
          tabIndex={0}
          aria-label={t('colorPicker.gradient')}
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
              aria-label={t('colorPicker.hueSlider')}
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
              aria-label={t('colorPicker.alphaSlider')}
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

    </>
  );
}
