# Future i18next Migration

## Summary
Replace Planner's custom translation runtime with `i18next` and `react-i18next` while preserving the existing `useI18n()` API, locale preference flow, date helpers, and visible behavior. Use a parity-first migration to minimize component rework.

## Key Changes
- Add compatible versions of `i18next` and `react-i18next`; do not add language-detector, HTTP-backend, or extraction packages initially.
- Keep translations in typed locale modules, with English as the key source and pt-BR required to satisfy every English key.
- Initialize static resources with English fallback, `en` and `pt-BR` support, flat dotted keys, React-safe interpolation, and Suspense disabled.
- Keep `I18nProvider`, `useI18n()`, `Locale`, and the current return shape. Internally, use `I18nextProvider`, `useTranslation()`, and `changeLanguage()`.
- Preserve locale precedence: cached locale for first paint, authenticated preference as source of truth, browser locale as fallback, then English.
- Keep document language synchronization, localStorage caching, preference synchronization, `Intl` date formatting, natural-language date parsing, and structured help content outside i18next during this phase.
- Remove the custom translation implementation only after parity tests pass. Do not change the API schema or database migration.

## Interfaces
- `useI18n()` remains compatible: `{ locale, setLocale, t, formatDate }`.
- Translation keys remain compile-time checked through i18next module augmentation.
- `setLocale()` resolves supported locales, calls `i18next.changeLanguage()`, updates the cache, and synchronizes the document language.
- Existing component call sites should require no changes except imports if files move.

## Test Plan
- Verify resource completeness, typed keys, English fallback, interpolation, and unsupported-locale handling.
- Verify cached-locale restoration, preference overrides, language changes, and `document.lang`.
- Keep existing English and pt-BR component tests passing without copy changes.
- Browser-test switching languages, reload persistence, saved authenticated preferences, and empty-cache startup.
- Run the complete app test, build, lint, Docker image, and CI security gates.

## Assumptions
- The initial migration targets behavior parity and minimal rework.
- Catalogs remain bundled TypeScript resources; namespaces and lazy loading are deferred.
- i18next pluralization, number/date formatting, extraction tooling, and translation-management integrations are future enhancements.
- Namespace splitting should be reconsidered when individual locale files become difficult to review or additional languages materially increase bundle size.
