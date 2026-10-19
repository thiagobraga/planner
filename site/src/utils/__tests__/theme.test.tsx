import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { readStoredTheme, setTheme, THEME_STORAGE_KEY } from '../theme';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.head.innerHTML = '<meta name="theme-color" content="#f5f0e8">';
});

describe('public theme preferences', () => {
  it('defaults to beige for missing and invalid stored preferences', () => {
    expect(readStoredTheme()).toBe('beige');
    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    expect(readStoredTheme()).toBe('beige');
  });

  it.each(['white', 'beige', 'dark'] as const)('restores and persists %s', (theme) => {
    setTheme(theme);
    expect(document.documentElement).toHaveAttribute('data-theme', theme);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(theme);
    expect(readStoredTheme()).toBe(theme);
  });

  it('keeps theme selection working when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readStoredTheme()).toBe('beige');
    expect(() => setTheme('dark')).not.toThrow();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('updates browser chrome to the selected page surface', () => {
    setTheme('dark');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#292219');
    setTheme('white');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#ffffff');
  });
});

describe('ThemeSwitcher', () => {
  it('offers named, focusable choices and exposes the selected choice', () => {
    render(<ThemeSwitcher />);
    const beige = screen.getByRole('button', { name: 'Beige' });
    expect(beige).toHaveAttribute('aria-pressed', 'true');
    const dark = screen.getByRole('button', { name: 'Dark' });
    dark.focus();
    expect(dark).toHaveFocus();
    fireEvent.click(dark);
    expect(dark).toHaveAttribute('aria-pressed', 'true');
    expect(beige).toHaveAttribute('aria-pressed', 'false');
  });

  it('restores the chosen palette when remounted', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'white');
    const { unmount } = render(<ThemeSwitcher />);
    expect(screen.getByRole('button', { name: 'White' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    unmount();
    render(<ThemeSwitcher />);
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps desktop and mobile selectors synchronized', () => {
    render(<><ThemeSwitcher label="Desktop theme" /><ThemeSwitcher label="Mobile theme" /></>);
    fireEvent.click(within(screen.getByRole('group', { name: 'Desktop theme' })).getByRole('button', { name: 'Dark' }));
    expect(within(screen.getByRole('group', { name: 'Mobile theme' })).getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  });
});
