# I18n Support for Planner

## Summary
Add internationalization to Planner and ship Brazilian Portuguese as the first supported locale. The work should move user-facing text out of components into translation catalogs, add locale resolution and persistence, and make locale-sensitive formatting follow the active language.

## Key Changes
- Add an app-level i18n layer with:
  - locale provider/hooks
  - translation catalogs for `en` and `pt-BR`
  - fallback to English for missing keys
  - `document.documentElement.lang` updates
- Persist locale in user preferences:
  - extend the preferences API and database schema
  - add a language selector in Settings
  - keep the current preference sync flow as the source of truth
- Localize visible UI text across the app:
  - auth screens
  - sidebar and navigation
  - help, settings, quick add, search, and empty states
  - buttons, labels, errors, and status text
- Make locale-sensitive formatting respect the active locale:
  - replace hardcoded `en-US` date previews and labels
  - localize natural-language task parsing and preview text for pt-BR
  - keep English fallback behavior intact for unsupported locales

## Test Plan
- Add unit tests for locale resolution, translation lookup, and preference persistence.
- Add coverage for pt-BR date parsing and preview formatting.
- Update page/component tests that assert user-facing text so they render under an explicit locale.
- Run the app build and test suite after implementation.

## Assumptions
- English remains the fallback/source locale.
- Brazilian Portuguese is the first completed locale and can be expanded later.
- The locale preference is stored with the existing preferences model rather than in a separate settings store.
