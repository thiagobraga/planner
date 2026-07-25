import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider, resolveLocale, translate, useI18n } from '../I18nContext';

describe('i18n', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  it('resolves Portuguese variants and falls back unsupported locales to English', () => {
    expect(resolveLocale('pt-BR')).toBe('pt-BR');
    expect(resolveLocale('pt-PT')).toBe('pt-BR');
    expect(resolveLocale('fr-FR')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });

  it('translates values and falls back to the English catalog for missing Portuguese keys', () => {
    expect(translate('pt-BR', 'search.noResults', { query: 'café' })).toBe('Nenhum resultado para “café”');
    expect(translate('pt-BR', 'auth.bulletJournalOnline')).toBe('Bullet journal online');
  });

  it('updates the document language when the active locale changes', () => {
    const { result } = renderHook(() => useI18n(), { wrapper: I18nProvider });

    act(() => result.current.setLocale('pt-BR'));

    expect(result.current.locale).toBe('pt-BR');
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('restores and updates the cached locale while preferences load', () => {
    window.localStorage.setItem('planner_locale', 'pt-BR');
    const { result } = renderHook(() => useI18n(), { wrapper: I18nProvider });

    expect(result.current.locale).toBe('pt-BR');

    act(() => result.current.setLocale('en'));

    expect(window.localStorage.getItem('planner_locale')).toBe('en');
  });
});
