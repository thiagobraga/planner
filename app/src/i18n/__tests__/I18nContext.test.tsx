import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { englishCatalog, portugueseBrazilCatalog } from '../catalogs';
import { createI18nInstance } from '../i18n';
import { I18nProvider, resolveLocale, translate, useI18n } from '../I18nContext';

describe('i18n', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = '';
  });

  it('keeps English and pt-BR catalogs complete and aligned', () => {
    const enKeys = Object.keys(englishCatalog).sort();
    const ptKeys = Object.keys(portugueseBrazilCatalog).sort();

    expect(ptKeys).toEqual(enKeys);
    for (const key of enKeys) {
      expect(englishCatalog[key as keyof typeof englishCatalog].length).toBeGreaterThan(0);
      expect(portugueseBrazilCatalog[key as keyof typeof portugueseBrazilCatalog].length).toBeGreaterThan(0);
    }
  });

  it('resolves Portuguese variants and falls back unsupported locales to English', () => {
    expect(resolveLocale('pt-BR')).toBe('pt-BR');
    expect(resolveLocale('pt-PT')).toBe('pt-BR');
    expect(resolveLocale('fr-FR')).toBe('en');
    expect(resolveLocale(null)).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });

  it('translates flat dotted keys with unescaped React-safe interpolation', () => {
    expect(translate('pt-BR', 'search.noResults', { query: 'café' })).toBe('Nenhum resultado para “café”');
    expect(translate('en', 'agentNotice.created', { agent: 'Claude', title: 'Buy "milk" & eggs' })).toBe(
      'Claude added "Buy "milk" & eggs"',
    );
  });

  it('falls back to English for missing localized keys or unsupported locales in i18next', () => {
    const partialPtCatalog = { ...portugueseBrazilCatalog } as Record<string, string>;
    delete partialPtCatalog['search.noResults'];

    const instance = createI18nInstance('pt-BR', {
      en: { translation: englishCatalog },
      'pt-BR': { translation: partialPtCatalog },
    });

    expect(instance.t('search.noResults', { query: 'test' })).toBe('No results for "test"');

    const unsupportedInstance = createI18nInstance('de-DE');
    expect(unsupportedInstance.language).toBe('en');
    expect(unsupportedInstance.t('common.save')).toBe('Save');
  });

  it('updates the i18next instance, cache, and document language when the active locale changes', () => {
    const { result } = renderHook(() => useI18n(), { wrapper: I18nProvider });

    act(() => result.current.setLocale('pt-BR'));

    expect(result.current.locale).toBe('pt-BR');
    expect(result.current.t('common.save')).toBe('Salvar');
    expect(window.localStorage.getItem('planner_locale')).toBe('pt-BR');
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('restores the cached locale on first paint and overrides it when preferences load', () => {
    window.localStorage.setItem('planner_locale', 'pt-BR');
    const { result } = renderHook(() => useI18n(), { wrapper: I18nProvider });

    expect(result.current.locale).toBe('pt-BR');
    expect(result.current.t('common.cancel')).toBe('Cancelar');
    expect(document.documentElement.lang).toBe('pt-BR');

    act(() => result.current.setLocale('en'));

    expect(result.current.locale).toBe('en');
    expect(result.current.t('common.cancel')).toBe('Cancel');
    expect(window.localStorage.getItem('planner_locale')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('falls back to the browser locale when no cached locale is present', () => {
    const languagesSpy = vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['pt-BR', 'en-US']);

    const { result } = renderHook(() => useI18n(), { wrapper: I18nProvider });
    expect(result.current.locale).toBe('pt-BR');

    languagesSpy.mockRestore();
  });
});
