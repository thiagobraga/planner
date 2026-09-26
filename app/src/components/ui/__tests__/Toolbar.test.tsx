import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { Toolbar } from '../Toolbar';

vi.mock('../../../api/client', () => ({
  fetchPreferences: vi.fn(async () => ({ background: 'beige' })),
  apiUpdatePreferences: vi.fn(),
}));

// The dropdown always ends with the theme picker, which reads preferences.
function render(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Toolbar', () => {
  it('renders a collapsed hamburger button and hides children until opened', () => {
    render(
      <Toolbar>
        <button>Today</button>
      </Toolbar>,
    );
    expect(screen.getByRole('button', { name: 'More options' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
  });

  it('reveals children in a dropdown panel when the hamburger is clicked', () => {
    render(
      <Toolbar>
        <button>Today</button>
      </Toolbar>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
  });

  it('closes the panel on outside click', () => {
    render(
      <div>
        <Toolbar>
          <button>Today</button>
        </Toolbar>
        <button>Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
  });

  it('closes the panel on Escape', () => {
    render(
      <Toolbar>
        <button>Today</button>
      </Toolbar>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
  });

  it('carries the page-header-toolbar class the header CSS targets', () => {
    const { container } = render(
      <Toolbar>
        <span>content</span>
      </Toolbar>,
    );
    expect(container.firstElementChild).toHaveClass('page-header-toolbar');
  });

  it('merges a page-specific className alongside its own base classes', () => {
    const { container } = render(
      <Toolbar className="daily-page-header-controls">
        <span>content</span>
      </Toolbar>,
    );
    expect(container.firstElementChild).toHaveClass('page-header-toolbar', 'daily-page-header-controls');
  });

  it('renders the viewSwitcher slot always visible, before the hamburger button', () => {
    const { container } = render(
      <Toolbar viewSwitcher={<button>Switch view</button>}>
        <span>content</span>
      </Toolbar>,
    );
    const switcher = screen.getByRole('button', { name: 'Switch view' });
    const hamburger = screen.getByRole('button', { name: 'More options' });
    expect(container.firstElementChild).toContainElement(switcher);
    expect(switcher.compareDocumentPosition(hamburger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('sizes the hamburger button to the 24px rhythm', () => {
    render(
      <Toolbar>
        <span>content</span>
      </Toolbar>,
    );
    expect(screen.getByRole('button', { name: 'More options' })).toHaveClass('w-6', 'h-6');
  });

  it('ends the dropdown with the theme picker, after the page controls', async () => {
    render(
      <Toolbar>
        <span>Show</span>
      </Toolbar>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));

    const menu = screen.getByRole('menu');
    const group = await screen.findByRole('radiogroup', { name: 'Theme' });
    expect(menu.lastElementChild).toBe(group);
    expect(screen.getByText('Show').compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
