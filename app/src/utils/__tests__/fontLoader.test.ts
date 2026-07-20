import { describe, it, expect, beforeEach } from 'vitest';
import { ensureFontLoaded } from '../fontLoader';

describe('ensureFontLoaded', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('does nothing for lora (no link created)', () => {
    ensureFontLoaded('lora');
    expect(document.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(0);
  });

  it('creates a link element for playpen with correct href', () => {
    ensureFontLoaded('playpen');
    const link = document.getElementById('font-playpen') as HTMLLinkElement | null;
    expect(link).not.toBeNull();
    expect(link!.rel).toBe('stylesheet');
    expect(link!.href).toContain('Playpen+Sans');
  });

  it('creates a link element for hubballi with correct href', () => {
    ensureFontLoaded('hubballi');
    const link = document.getElementById('font-hubballi') as HTMLLinkElement | null;
    expect(link).not.toBeNull();
    expect(link!.rel).toBe('stylesheet');
    expect(link!.href).toContain('Hubballi');
  });

  it('does not duplicate link if already loaded', () => {
    ensureFontLoaded('playpen');
    ensureFontLoaded('playpen');
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    expect(links).toHaveLength(1);
  });
});
