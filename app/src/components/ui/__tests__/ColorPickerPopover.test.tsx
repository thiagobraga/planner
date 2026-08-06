import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ColorPickerPopover } from '../ColorPickerPopover';
import { fetchSavedColors, apiAddSavedColor } from '../../../api/client';

vi.mock('../../../api/client', () => ({
  fetchSavedColors: vi.fn(),
  apiAddSavedColor: vi.fn(),
  PALETTE_COLORS: ['#d56b64', '#65788a'],
}));

const mockFetchSavedColors = vi.mocked(fetchSavedColors);
const mockApiAddSavedColor = vi.mocked(apiAddSavedColor);

function renderPicker(props: Partial<React.ComponentProps<typeof ColorPickerPopover>> = {}) {
  const onCommit = props.onCommit ?? vi.fn();
  const onClose = props.onClose ?? vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const result = render(
    <QueryClientProvider client={qc}>
      <ColorPickerPopover
        position={{ x: 40, y: 40 }}
        value={props.value ?? '#c9483b'}
        onCommit={onCommit}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );

  return { ...result, onCommit, onClose };
}

function stubRect(el: HTMLElement, rect: Partial<DOMRect>) {
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...rect,
    }) as DOMRect;
}

describe('ColorPickerPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSavedColors.mockResolvedValue([]);
    mockApiAddSavedColor.mockResolvedValue([]);
  });

  afterEach(() => {
    delete (window as { EyeDropper?: unknown }).EyeDropper;
  });

  it('shows the current color in the value input', () => {
    renderPicker({ value: '#c9483b' });
    expect(screen.getByLabelText('Color value')).toHaveValue('#c9483b');
  });

  it('renders the app colors row from PALETTE_COLORS', () => {
    renderPicker();
    expect(screen.getByLabelText('Apply #d56b64')).toBeInTheDocument();
    expect(screen.getByLabelText('Apply #65788a')).toBeInTheDocument();
  });

  it('renders fetched saved colors and an empty state when there are none', async () => {
    const { unmount } = renderPicker();
    expect(await screen.findByText('No saved colors yet')).toBeInTheDocument();
    unmount();

    mockFetchSavedColors.mockResolvedValue(['#123456']);
    renderPicker();
    expect(await screen.findByLabelText('Apply #123456')).toBeInTheDocument();
    expect(screen.queryByText('No saved colors yet')).not.toBeInTheDocument();
  });

  it('applying a swatch commits the color and saves it to the MRU list', async () => {
    const { onCommit } = renderPicker();

    fireEvent.click(screen.getByLabelText('Apply #d56b64'));

    expect(onCommit).toHaveBeenCalledWith('#d56b64');
    await waitFor(() => expect(mockApiAddSavedColor).toHaveBeenCalledWith('#d56b64'));
    expect(screen.getByLabelText('Color value')).toHaveValue('#d56b64');
  });

  it('refreshes saved colors when saving a committed color fails', async () => {
    mockApiAddSavedColor.mockRejectedValueOnce(new Error('offline'));
    const { onCommit } = renderPicker({ value: '#c9483b' });
    const input = screen.getByLabelText('Color value');

    fireEvent.change(input, { target: { value: '#65788a' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledWith('#65788a');
    await waitFor(() => expect(mockFetchSavedColors).toHaveBeenCalledTimes(2));
  });

  it('commits a value typed into the input on Enter', async () => {
    const { onCommit } = renderPicker();
    const input = screen.getByLabelText('Color value');

    fireEvent.change(input, { target: { value: '#00ff00' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledWith('#00ff00');
    await waitFor(() => expect(mockApiAddSavedColor).toHaveBeenCalledWith('#00ff00'));
  });

  it('commits a value typed into the input on blur', () => {
    const { onCommit } = renderPicker();
    const input = screen.getByLabelText('Color value');

    fireEvent.change(input, { target: { value: 'rgb(0, 0, 255)' } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith('#0000ff');
  });

  it('ignores an unparseable typed value', () => {
    const { onCommit } = renderPicker();
    const input = screen.getByLabelText('Color value');

    fireEvent.change(input, { target: { value: 'chartreuse' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('#c9483b');
  });

  describe('channel fields', () => {
    function selectFormat(format: 'hex' | 'rgb' | 'hsl') {
      fireEvent.change(screen.getByLabelText('Color format'), { target: { value: format } });
    }

    it('splits RGB into separate R, G and B fields', () => {
      renderPicker({ value: '#c9483b' });
      selectFormat('rgb');

      expect(screen.queryByLabelText('Color value')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Red')).toHaveValue('201');
      expect(screen.getByLabelText('Green')).toHaveValue('72');
      expect(screen.getByLabelText('Blue')).toHaveValue('59');
      expect(screen.getByText('r')).toBeVisible();
      expect(screen.getByText('g')).toBeVisible();
      expect(screen.getByText('b')).toBeVisible();
    });

    it('splits HSL into separate H, S and L fields', () => {
      renderPicker({ value: '#c9483b' });
      selectFormat('hsl');

      expect(screen.getByLabelText('Hue')).toHaveValue('5');
      expect(screen.getByLabelText('Saturation')).toHaveValue('57');
      expect(screen.getByLabelText('Lightness')).toHaveValue('51');
      expect(screen.getByText('h')).toBeVisible();
      expect(screen.getByText('s')).toBeVisible();
      expect(screen.getByText('l')).toBeVisible();
    });

    it('keeps a single field for hex', () => {
      renderPicker({ value: '#c9483b' });
      expect(screen.getByLabelText('Color value')).toHaveValue('#c9483b');
      expect(screen.queryByLabelText('Red')).not.toBeInTheDocument();
    });

    it('commits an edited RGB channel and leaves the others alone', () => {
      const { onCommit } = renderPicker({ value: '#c9483b' });
      selectFormat('rgb');

      const green = screen.getByLabelText('Green');
      fireEvent.change(green, { target: { value: '200' } });
      fireEvent.keyDown(green, { key: 'Enter' });

      expect(onCommit).toHaveBeenCalledWith('rgb(201, 200, 59)');
      expect(screen.getByLabelText('Red')).toHaveValue('201');
      expect(screen.getByLabelText('Blue')).toHaveValue('59');
    });

    it('commits an edited HSL channel', () => {
      const { onCommit } = renderPicker({ value: '#c9483b' });
      selectFormat('hsl');

      const hue = screen.getByLabelText('Hue');
      fireEvent.change(hue, { target: { value: '210' } });
      fireEvent.blur(hue);

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0][0]).toMatch(/^hsl\(210, \d+%, \d+%\)$/);
    });

    it('clamps an out-of-range channel to its maximum', () => {
      const { onCommit } = renderPicker({ value: '#c9483b' });
      selectFormat('rgb');

      const blue = screen.getByLabelText('Blue');
      fireEvent.change(blue, { target: { value: '999' } });
      expect(blue).toHaveAttribute('aria-invalid', 'true');
      fireEvent.keyDown(blue, { key: 'Enter' });

      expect(onCommit).toHaveBeenCalledWith('rgb(201, 72, 255)');
      expect(screen.getByLabelText('Blue')).toHaveAttribute('aria-invalid', 'false');
    });

    it('clamps saturation and lightness to 100', () => {
      const { onCommit } = renderPicker({ value: '#c9483b' });
      selectFormat('hsl');

      const saturation = screen.getByLabelText('Saturation');
      fireEvent.change(saturation, { target: { value: '900' } });
      fireEvent.keyDown(saturation, { key: 'Enter' });

      expect(onCommit).toHaveBeenCalledWith(expect.stringContaining('100%'));
    });

    it.each([
      ['empty', ''],
      ['whitespace', '   '],
      ['letters', 'ff'],
      ['negative', '-5'],
      ['decimal', '12.5'],
      ['four digits', '1234'],
    ])('rejects a %s channel value without committing', (_label, value) => {
      const { onCommit } = renderPicker({ value: '#c9483b' });
      selectFormat('rgb');

      const red = screen.getByLabelText('Red');
      fireEvent.change(red, { target: { value } });
      expect(red).toHaveAttribute('aria-invalid', 'true');
      fireEvent.keyDown(red, { key: 'Enter' });

      expect(onCommit).not.toHaveBeenCalled();
      expect(mockApiAddSavedColor).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Red')).toHaveValue('201');
    });

    it('does not commit when a field is blurred without an edit', () => {
      const { onCommit } = renderPicker({ value: '#c9483b' });
      selectFormat('rgb');

      fireEvent.blur(screen.getByLabelText('Red'));
      fireEvent.blur(screen.getByLabelText('Green'));

      expect(onCommit).not.toHaveBeenCalled();
    });

    it('does not commit when the typed value matches the current one', () => {
      const { onCommit } = renderPicker({ value: '#c9483b' });
      selectFormat('rgb');

      const red = screen.getByLabelText('Red');
      fireEvent.change(red, { target: { value: '201' } });
      fireEvent.keyDown(red, { key: 'Enter' });

      expect(onCommit).not.toHaveBeenCalled();
    });

    it('reverts a draft on Escape', () => {
      renderPicker({ value: '#c9483b' });
      selectFormat('rgb');

      const red = screen.getByLabelText('Red');
      fireEvent.change(red, { target: { value: '10' } });
      expect(red).toHaveValue('10');

      fireEvent.keyDown(red, { key: 'Escape' });
      expect(screen.getByLabelText('Red')).toHaveValue('201');
    });

    it('drops a pending draft when the format changes', () => {
      const { onCommit } = renderPicker({ value: '#c9483b' });
      selectFormat('rgb');

      fireEvent.change(screen.getByLabelText('Red'), { target: { value: '10' } });
      selectFormat('hsl');
      selectFormat('rgb');

      expect(screen.getByLabelText('Red')).toHaveValue('201');
      expect(onCommit).not.toHaveBeenCalled();
    });

    it('shows the alpha-aware channel values without an alpha field', () => {
      renderPicker({ value: 'rgba(201, 72, 59, 0.5)' });

      expect(screen.getByLabelText('Red')).toHaveValue('201');
      expect(screen.getByLabelText('Opacity slider')).toHaveAttribute('aria-valuenow', '50');
    });
  });

  it('nudges hue with arrow keys and commits once on key release', () => {
    const { onCommit } = renderPicker({ value: '#c9483b' });
    const hue = screen.getByLabelText('Hue slider');
    const before = Number(hue.getAttribute('aria-valuenow'));

    fireEvent.keyDown(hue, { key: 'ArrowRight' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(Number(hue.getAttribute('aria-valuenow'))).toBe(before + 1);

    fireEvent.keyUp(hue, { key: 'ArrowRight' });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('nudges saturation and brightness from the gradient square', () => {
    const { onCommit } = renderPicker({ value: '#c9483b' });
    const square = screen.getByLabelText('Saturation and brightness');
    const before = Number(square.getAttribute('aria-valuenow'));

    fireEvent.keyDown(square, { key: 'ArrowLeft' });
    fireEvent.keyUp(square, { key: 'ArrowLeft' });

    expect(Number(square.getAttribute('aria-valuenow'))).toBe(before - 1);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('nudges brightness vertically and ignores unrelated keys', () => {
    const { onCommit } = renderPicker({ value: '#c9483b' });
    const square = screen.getByLabelText('Saturation and brightness');
    const before = Number(square.getAttribute('aria-valuenow'));

    fireEvent.keyDown(square, { key: 'ArrowUp' });
    fireEvent.keyDown(square, { key: 'ArrowDown' });
    fireEvent.keyDown(square, { key: 'Tab' });
    fireEvent.keyUp(square, { key: 'Tab' });

    expect(square).toHaveAttribute('aria-valuenow', String(before));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits an alpha change in a notation the API accepts', () => {
    const { onCommit } = renderPicker({ value: '#c9483b' });
    const alpha = screen.getByLabelText('Opacity slider');

    expect(alpha).toHaveAttribute('aria-valuenow', '100');
    fireEvent.keyDown(alpha, { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyUp(alpha, { key: 'ArrowLeft' });

    expect(alpha).toHaveAttribute('aria-valuenow', '90');
    expect(onCommit).toHaveBeenCalledWith('#c9483be6');
  });

  it('hides the eyedropper when the browser does not support it', () => {
    renderPicker();
    expect(screen.queryByLabelText('Pick a color from the screen')).not.toBeInTheDocument();
  });

  it('shows the eyedropper when supported and applies the picked color', async () => {
    const open = vi.fn().mockResolvedValue({ sRGBHex: '#abcdef' });
    (window as { EyeDropper?: unknown }).EyeDropper = class {
      open = open;
    };

    const { onCommit } = renderPicker();
    const button = screen.getByLabelText('Pick a color from the screen');
    fireEvent.click(button);

    await waitFor(() => expect(onCommit).toHaveBeenCalledWith('#abcdef'));
  });

  it('closes on Escape', () => {
    const { onClose } = renderPicker();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when clicking outside the panel', () => {
    const { onClose } = renderPicker();
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  describe('pointer dragging', () => {
    it('sets saturation and brightness from a drag on the square, committing on release', () => {
      const { onCommit } = renderPicker({ value: '#c9483b' });
      const square = screen.getByLabelText('Saturation and brightness');
      stubRect(square, { width: 200, height: 100 });

      fireEvent.pointerDown(square, { clientX: 100, clientY: 25, buttons: 1 });
      expect(square).toHaveAttribute('aria-valuenow', '50');
      expect(onCommit).not.toHaveBeenCalled();

      fireEvent.pointerMove(square, { clientX: 150, clientY: 25, buttons: 1 });
      expect(square).toHaveAttribute('aria-valuenow', '75');

      fireEvent.pointerUp(square);
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it('ignores a pointer move with no button held', () => {
      renderPicker({ value: '#c9483b' });
      const square = screen.getByLabelText('Saturation and brightness');
      stubRect(square, { width: 200, height: 100 });

      fireEvent.pointerDown(square, { clientX: 100, clientY: 50, buttons: 1 });
      const held = square.getAttribute('aria-valuenow');

      fireEvent.pointerMove(square, { clientX: 10, clientY: 90, buttons: 0 });
      expect(square).toHaveAttribute('aria-valuenow', held!);
    });

    it('sets hue from a drag on the hue slider', () => {
      const { onCommit } = renderPicker({ value: '#c9483b' });
      const hue = screen.getByLabelText('Hue slider');
      stubRect(hue, { width: 200, height: 8 });

      fireEvent.pointerDown(hue, { clientX: 100, clientY: 4, buttons: 1 });
      expect(hue).toHaveAttribute('aria-valuenow', '180');

      fireEvent.pointerMove(hue, { clientX: 150, clientY: 4, buttons: 1 });
      expect(hue).toHaveAttribute('aria-valuenow', '270');

      fireEvent.pointerUp(hue);
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it('sets opacity from a drag on the alpha slider', () => {
      const { onCommit } = renderPicker({ value: '#c9483b' });
      const alpha = screen.getByLabelText('Opacity slider');
      stubRect(alpha, { width: 200, height: 8 });

      fireEvent.pointerDown(alpha, { clientX: 50, clientY: 4, buttons: 1 });
      expect(alpha).toHaveAttribute('aria-valuenow', '25');

      fireEvent.pointerUp(alpha);
      expect(onCommit).toHaveBeenCalledWith('#c9483b40');
    });

    it('clamps a drag past the edges of the track', () => {
      renderPicker({ value: '#c9483b' });
      const alpha = screen.getByLabelText('Opacity slider');
      stubRect(alpha, { width: 200, height: 8 });

      fireEvent.pointerDown(alpha, { clientX: -50, clientY: 4, buttons: 1 });
      expect(alpha).toHaveAttribute('aria-valuenow', '0');

      fireEvent.pointerMove(alpha, { clientX: 900, clientY: 4, buttons: 1 });
      expect(alpha).toHaveAttribute('aria-valuenow', '100');
    });

    it('ignores a drag before the panel has been laid out', () => {
      const { onCommit } = renderPicker({ value: '#c9483b' });
      const square = screen.getByLabelText('Saturation and brightness');
      // jsdom reports a zero-sized rect until something stubs it.
      fireEvent.pointerDown(square, { clientX: 40, clientY: 40, buttons: 1 });

      expect(square).toHaveAttribute('aria-valuenow', '71');
      expect(onCommit).not.toHaveBeenCalled();
    });
  });

  describe('positioning', () => {
    it('clamps the panel back inside the viewport', () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={qc}>
          <ColorPickerPopover
            position={{ x: 5000, y: 5000 }}
            value="#c9483b"
            onCommit={vi.fn()}
            onClose={vi.fn()}
          />
        </QueryClientProvider>,
      );

      const panel = screen.getByRole('dialog');
      expect(parseInt(panel.style.left, 10)).toBeLessThan(5000);
      expect(parseInt(panel.style.top, 10)).toBeLessThan(5000);
      expect(parseInt(panel.style.left, 10)).toBeGreaterThanOrEqual(8);
      expect(parseInt(panel.style.top, 10)).toBeGreaterThanOrEqual(8);
    });
  });

  it('leaves the colour alone when the eyedropper is dismissed', async () => {
    const open = vi.fn().mockRejectedValue(new Error('AbortError'));
    (window as { EyeDropper?: unknown }).EyeDropper = class {
      open = open;
    };

    const { onCommit } = renderPicker();
    fireEvent.click(screen.getByLabelText('Pick a color from the screen'));

    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('falls back to a default colour when handed an unparseable value', () => {
    renderPicker({ value: 'not-a-colour' });
    expect(screen.getByLabelText('Color value')).toHaveValue('#65788a');
  });
});
