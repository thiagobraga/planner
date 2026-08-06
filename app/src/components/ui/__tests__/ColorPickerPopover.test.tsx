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

  it('switches the displayed format', () => {
    renderPicker({ value: '#c9483b' });

    fireEvent.change(screen.getByLabelText('Color format'), { target: { value: 'rgb' } });
    expect(screen.getByLabelText('Color value')).toHaveValue('rgb(201, 72, 59)');

    fireEvent.change(screen.getByLabelText('Color format'), { target: { value: 'hsl' } });
    expect(screen.getByLabelText('Color value')).toHaveValue('hsl(5, 57%, 51%)');
  });

  it('nudges hue with arrow keys and commits once on key release', () => {
    const { onCommit } = renderPicker({ value: '#c9483b' });
    const hue = screen.getByLabelText('Hue');
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

  it('commits an alpha change in a notation the API accepts', () => {
    const { onCommit } = renderPicker({ value: '#c9483b' });
    const alpha = screen.getByLabelText('Opacity');

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
});
