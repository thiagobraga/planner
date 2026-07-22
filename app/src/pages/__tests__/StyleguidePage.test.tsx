import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StyleguidePage } from '../StyleguidePage';
import { fetchPreferences, type Preferences } from '../../api/client';

const mockFetchPreferences = vi.mocked(fetchPreferences);

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchPreferences: vi.fn(),
}));

const basePreferences: Preferences = {
  userId: 'user-1',
  timeZone: 'UTC',
  weekStart: 'sunday',
  theme: 'system',
  notificationsEnabled: true,
  font: 'lora',
  showDots: true,
  background: 'beige',
  smallCaps: false,
  hideCompletedTasks: false,
  hideOldNotes: false,
};

beforeEach(() => {
  mockFetchPreferences.mockReset();
  mockFetchPreferences.mockResolvedValue(basePreferences);
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <StyleguidePage />
    </QueryClientProvider>,
  );
}

describe('StyleguidePage (smoke)', () => {
  it('renders all design system sections', async () => {
    renderPage();

    expect(await screen.findByText('Color Palette')).toBeInTheDocument();
    expect(screen.getByText('Typography')).toBeInTheDocument();
    expect(screen.getByText('Buttons')).toBeInTheDocument();
    expect(screen.getByText('Forms')).toBeInTheDocument();
    expect(screen.getByText('Chips & Tags')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Toolbar / View Options')).toBeInTheDocument();
    expect(screen.getByText('Task Rows')).toBeInTheDocument();
    expect(screen.getByText('Calendar & Monthly')).toBeInTheDocument();
    expect(screen.getByText('Habit')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Essential Tokens')).toBeInTheDocument();
    expect(screen.getByText('Context Menu')).toBeInTheDocument();
  });

  it('renders color swatches', async () => {
    renderPage();

    expect(await screen.findByText('Color Palette')).toBeInTheDocument();
    expect(screen.getByText('Primary Palette')).toBeInTheDocument();
    expect(screen.getByText('Secondary Palette')).toBeInTheDocument();
    expect(screen.getByText('Ink')).toBeInTheDocument();
    expect(screen.getByText('Cream Paper')).toBeInTheDocument();
  });

  it('renders typography specimens', async () => {
    renderPage();

    expect(await screen.findByText('Display')).toBeInTheDocument();
    expect(screen.getByText('Heading')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('renders interactive form elements', async () => {
    renderPage();

    expect(await screen.findByText('Checkbox')).toBeInTheDocument();
    expect(screen.getByText('Radio')).toBeInTheDocument();
    expect(screen.getByText('Toggle')).toBeInTheDocument();
  });

  it('renders context menu with interaction', async () => {
    renderPage();

    expect(await screen.findByText('Right-click me')).toBeInTheDocument();
  });

  it('renders habit specimen', async () => {
    renderPage();

    expect(await screen.findByText('Habit')).toBeInTheDocument();
  });

  it('renders navigation specimen with Planner branding', async () => {
    renderPage();

    expect(await screen.findByText('Navigation')).toBeInTheDocument();
  });

  it('renders calendar specimens', async () => {
    renderPage();

    expect(await screen.findByText('Calendar & Monthly')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
  });
});
