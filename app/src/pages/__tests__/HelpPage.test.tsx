import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { HelpPage } from '../HelpPage';

let observers: IntersectionObserver[] = [];

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(() => {
      const instance = {
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
      };
      observers.push(instance as unknown as IntersectionObserver);
      return instance;
    }),
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
  observers = [];
});

describe('HelpPage (smoke)', () => {
  it('renders header', () => {
    render(<HelpPage />);

    expect(screen.getByText('Help')).toBeInTheDocument();
    expect(screen.getByText('Learn how to use Planner')).toBeInTheDocument();
  });

  it('renders all help sections', () => {
    render(<HelpPage />);

    expect(screen.getAllByText('Welcome').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Getting Started').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Views').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Habits').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Table of Contents sidebar', () => {
    render(<HelpPage />);

    expect(screen.getByText('On This Page')).toBeInTheDocument();
    const tocLinks = screen.getAllByText('Getting Started');
    expect(tocLinks.length).toBe(2);
    const sections = screen.getAllByText('Keyboard Shortcuts');
    expect(sections.length).toBe(2);
  });

  it('renders keyboard shortcut table', () => {
    render(<HelpPage />);

    const qKeys = screen.getAllByText('Q');
    expect(qKeys.length).toBeGreaterThan(0);
    expect(screen.getByText('Quick add task')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Toggle help dialog')).toBeInTheDocument();
  });

  it('scrolls to section when TOC link is clicked', () => {
    render(<HelpPage />);

    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const settingsLinks = screen.getAllByRole('link', { name: 'Settings' });
    const tocLink = settingsLinks[0];
    fireEvent.click(tocLink);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('observes sections with IntersectionObserver', () => {
    render(<HelpPage />);

    expect(observers.length).toBeGreaterThan(0);
    expect(observers[0].observe).toHaveBeenCalled();
  });
});
