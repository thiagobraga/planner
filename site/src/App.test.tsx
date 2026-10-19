import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { GITHUB_URL, REGISTER_URL } from './config';

beforeEach(() => { localStorage.clear(); document.documentElement.dataset.theme = 'beige'; });

describe('public landing page', () => {
  it('links registration and source actions to real destinations', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The calm of paper.');
    expect(screen.getByRole('link', { name: /Start journaling/ })).toHaveAttribute('href', REGISTER_URL);
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', GITHUB_URL);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href')!;
      expect(href).toMatch(/^(https:\/\/|#[a-z])/);
      if (href.startsWith('#')) expect(document.querySelector(href)).not.toBeNull();
    }
  });

  it('shows real app screenshots on each device', () => {
    render(<App />);
    for (const [alt, src] of [['Planner daily list on a laptop', '/screens/desktop.png'], ['Planner monthly view on a tablet', '/screens/tablet.png'], ['Planner daily list on a phone', '/screens/phone.png']]) {
      expect(screen.getAllByAltText(alt)[0]).toHaveAttribute('src', src);
    }
  });

  it('supports keyboard tab selection and FAQ disclosure', () => {
    render(<App />);
    const desk = screen.getByRole('tab', { name: 'Desk' });
    fireEvent.keyDown(desk, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Desktop' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Desktop');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Desktop' }), { key: 'End' });
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Mobile');
    const question = screen.getByRole('button', { name: /Can I self-host/ });
    fireEvent.click(question);
    expect(question).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: /Can I self-host/ })).toHaveTextContent('MIT-licensed');
    fireEvent.click(question);
    expect(question).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes mobile navigation with Escape and restores focus', () => {
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'Toggle menu' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });
});
