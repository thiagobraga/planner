# Settings page redesign

**Status:** Penpot prototype drawn, waiting for approval (file "New File 1", page "Settings redesign"). Development starts only after the prototype is approved.

## Why

Settings is ugly, confusing and wastes space. Every option is an uppercase label over full-width radio cards, so 5 date formats fill a screen. Nav sits on the right in a dark block. There is no search. Options live in odd places: task display is split across General and Appearance, and delete account sits under General next to language.

Goal: clean, compact, easy to find, modeled on Zed's settings (left nav, search on top, one row per option, control on the right), kept in Planner's paper look.

## Decisions

Made together:

| Topic | Decision |
| --- | --- |
| Structure | 5 sections: General, Appearance, Tasks, Integrations, Account |
| Search | Included, above the nav |
| Review | Penpot prototype approved before development |

## Sections

| Section (URL) | Rows |
| --- | --- |
| General `/settings/general` | Language, Time zone, Week starts on, Date format |
| Appearance `/settings/appearance` | Theme, Font, Small caps, Dot grid |
| Tasks `/settings/tasks` (new) | Hide completed, Show notes, Show checkboxes |
| Integrations `/settings/integrations` | Agent notices, Connect an agent, Connected apps, API tokens, Recent agent activity |
| Account `/settings/account` (new) | Export data, Delete account, Privacy policy and Terms |

Unknown sections still redirect to General. The topbar spec's nav style row goes in General, added by whichever PR lands second.

## Layout

```
Settings
+--------------------+-------------------------------------------------+
| [Search settings]  | General                                         |
|                    | ----------------------------------------------- |
| > General          | Language                       [Portugues   v]  |
|   Appearance       | ----------------------------------------------- |
|   Tasks            | Time zone                      [Sao_Paulo   Q]  |
|   Integrations     | Detected: America/Sao_Paulo                     |
|   Account          | ----------------------------------------------- |
|                    | Week starts on                 [Sunday      v]  |
|                    | ----------------------------------------------- |
|                    | Date format                    [05/08 QUA   v]  |
| Saved automatically|                                                 |
+--------------------+-------------------------------------------------+
```

Proposed by the agent, open to correction in the Penpot review:

- **Nav:** left, 216px, same paper surface. Active item uses sidebar tint tokens. Dark aside removed.
- **Header:** title only. Subtitle becomes a short "Saved automatically" caption at the nav's foot.
- **Rows:** 48px for title only, 72px with description, 1px separator, snapped to 24px rhythm. Descriptions only where the name is not self-explanatory.
- **Controls:**
  - Select (native `Select`, per DESIGN.md): Language, Week start, Date format
  - Toggle: all on/off options
  - Time zone: existing search combobox
  - Font: 3-segment `ButtonGroup`, each label in its own font
  - Theme: 4 small swatches, the one visual control kept
- **Integrations:** block rows, because lists and snippets do not fit a single row. Snippets stay full width, uppercase labels go.
- **Below 1024px:** nav becomes search plus a horizontally scrolling tab strip with text labels (icons alone today). 1024 because the app sidebar still takes 220px.
- **390px:** wide controls drop under their title, toggles stay inline.

## Search

- Input above nav filters by title, description and section name in the current language, ignoring case and accents ("fuso horario" finds "Fuso horário").
- Results are the real, working rows, grouped by section. Esc clears. Empty state message.
- Client-side only, no API change. Global `/` shortcut stays on app search.
- Same as switching sections today: if results hide API tokens while a new token is revealed, the reveal is lost.

## Relevant Files

- `app/src/pages/SettingsPage.tsx`
- `app/src/pages/__tests__/SettingsPage.test.tsx`
- `app/src/components/settings/` (`AccountDataSection`, `ApiTokensSection`, `ConnectAgentPanel`, `ConnectedAppsSection`, plus new files below)
- `app/src/hooks/useSettingsPreferences.ts` (new)
- `app/src/types/settings.ts` (new)
- `app/src/i18n/locales/en.ts`, `app/src/i18n/locales/pt-BR.ts`
- `app/src/i18n/legal/privacyEn.ts`, `privacyPtBR.ts`, `termsEn.ts`, `termsPtBR.ts`
- `app/src/styles/theme.css`, `app/src/utils/__tests__/__snapshots__/themePalette.test.ts.snap`
- `app/e2e/settingsHeader.spec.ts`, `app/e2e/privacyLegal.spec.ts`
- `DESIGN.md`, `CLAUDE.md`, `README.md`

## Tasks

Frontend only. No API, migration or `publishEvent` changes. Preference fields stay as they are.

### 1. Prototype

- [x] 1.1 Draw in Penpot: General, Appearance, Integrations, search results, 390px, cream and dark (needs the Penpot plugin connected)
- [ ] 1.2 Get approval and apply corrections to this spec

Points raised by the prototype, to confirm in 1.2:

- Connect an agent now sits above API tokens, so its copy changes from "a token from above" to "a token from below" (`en.ts`, `pt-BR.ts`).
- Account shows Privacy Policy and Terms as 2 link rows instead of 1 combined row.
- Export data and Delete account need new short descriptions, replacing the shared `settings.accountData.description`.
- Below 1024px, the active tab scrolls into view, otherwise "Conta" is cut off at 390px.
- While searching, no nav item is highlighted.

### 2. Setup (after approval)

- [ ] 2.1 Create worktree `.worktrees/settings-redesign` on `feat/settings-redesign`
- [ ] 2.2 Copy `.env.example`, set `COMPOSE_PROJECT_NAME=planner-claude` and `APP_SUBDOMAIN=claude.planner`, run `bash .hooks/setup-hooks.sh`, `docker compose up -d`
- [ ] 2.3 Open draft PR against `main`

### 3. Split `SettingsPage.tsx` (901 lines) into a thin shell, with tests first

- [ ] 3.1 `app/src/types/settings.ts`: section and entry types
- [ ] 3.2 `components/settings/settingsIndex.ts`: ordered entries `{ id, section, titleKey, descriptionKey?, layout }` and pure matcher, one render path for section view and search results
- [ ] 3.3 `hooks/useSettingsPreferences.ts`: move existing optimistic `updateMutation` with rollback as is
- [ ] 3.4 `components/settings/SettingRow.tsx`: row primitive, `<label htmlFor>` names the control so `Toggle` and `Select` need no change
- [ ] 3.5 `components/settings/TimeZoneCombobox.tsx`: lift from the page unchanged
- [ ] 3.6 `components/settings/SettingsNav.tsx`: search plus tablist, keep arrow, Home and End behavior from `SettingsTabList`, render once instead of the desktop and mobile copies
- [ ] 3.7 `components/settings/settingControls.tsx`: entry id to control, reusing `Select`, `Toggle`, `ButtonGroup`, `Input`, `Button`, `THEME_SWATCHES`, `backgroundPreviewStyle`

### 4. Move and rework sections

- [ ] 4.1 Add `tasks` and `account` sections and URLs
- [ ] 4.2 `AccountDataSection`: split into rows, no `border-t`, keep `ConfirmModal`
- [ ] 4.3 `ApiTokensSection`: pull "Recent agent activity" and `ConnectAgentPanel` into own entries, lift `revealed` to a shared parent so `ConnectAgentPanel` still receives the token
- [ ] 4.4 Date format: replace hard-coded "Date display" and mixed-language examples (`AUG 05 WED`, `05/08 QUA`) with i18n keys and examples from `formatColumnDate` (used by `app/src/components/board/DailyWeekBoard.tsx`) in the current locale
- [ ] 4.5 i18n: add `settings.tasks`, `settings.account`, search keys and the caption to `en.ts` and `pt-BR.ts`

### 5. Search

- [ ] 5.1 Filter by title, description and section name, ignoring case and accents
- [ ] 5.2 Show real rows grouped by section, Esc clears, empty state

### 6. Responsive

- [ ] 6.1 Below 1024px: search plus scrolling tab strip with text labels
- [ ] 6.2 At 390px: wide controls under their title, toggles inline

### 7. Cleanup and docs

- [ ] 7.1 Legal copy: `Settings > General > Data & Privacy` becomes `Settings > Account` in the 4 legal files, called out in the PR because it edits published legal text
- [ ] 7.2 Remove `--color-settings-aside` and `--color-on-aside` from `theme.css`, regenerate the `themePalette` snapshot, delete `SelectionMark` and `selectedFrame`
- [ ] 7.3 Document the settings pattern in `DESIGN.md`, update routes in `CLAUDE.md`, check `README.md` paths

### 8. Verify

- [ ] 8.1 Unit: rewrite `SettingsPage.test.tsx` for 5 sections and URLs, moved options, search (cross-section, accents, empty, Esc), keyboard tabs, optimistic rollback; keep `AccountDataSection.test.tsx` passing
- [ ] 8.2 E2E: replace `settingsHeader.spec.ts` (subtitle gone) with a layout spec at 390, 660 and 1440px covering horizontal overflow and row heights; point `privacyLegal.spec.ts` at `/settings/account`
- [ ] 8.3 E2E: `darkTheme`, `apiTokens`, `mcpServer`, `mcpOAuth` and `agentActivity` pass with no flow changes
- [ ] 8.4 Run `docker compose exec app npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`
- [ ] 8.5 Browser: every section in cream and dark at desktop and 390px, exercise one control per type and search, check console errors, screenshots in `app/dist/screenshots/`
- [ ] 8.6 `wc -l` on touched files, all under 1000
- [ ] 8.7 Mark PR ready for review
