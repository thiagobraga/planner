# Date Picker Redesign - Tasks

## 1. Setup

- [ ] 1.1 `git worktree add ../planner-date-picker -b feat/date-picker-redesign`
- [ ] 1.2 `.env` from `.env.example`; `COMPOSE_PROJECT_NAME=planner-datepicker`, `APP_SUBDOMAIN=datepicker.planner`
- [ ] 1.3 Cert + `/etc/hosts` for `datepicker.planner.local` if not covered by wildcard
- [ ] 1.4 `bash .hooks/setup-hooks.sh`; `docker compose up -d`
- [ ] 1.5 Push branch, open draft PR against `main`

## 2. Recurrence rule extension (API, TDD)

- [ ] 2.1 Move `RecurrenceRule` to `api/src/types/recurrence.ts`; import from `recurrenceEngine.ts` and `dateParser.ts` (drop duplicate at `dateParser.ts:6-12`)
  - Add `fromCompletion?: boolean`, `until?: string` (YYYY-MM-DD). JSONB column, no migration.
- [ ] 2.2 `completeTask` (`api/src/services/taskService.ts:~95`)
  - `fromCompletion`: base date = today in user timezone (reuse helper from `api/src/mcp/resolve.ts` / `dailyService`), not `task.due_date`
  - `until`: if next date > `until`, complete without cloning
  - Deadline offset logic for clone unchanged
- [ ] 2.3 Validate `recurrenceRule` in `api/src/utils/taskValidation.ts`: type enum, interval 1-999, weekdays 0-6 unique, `until` ISO date, `fromCompletion` boolean; 400 `AppError`
- [ ] 2.4 Tests: `recurrenceEngine.test.ts`, `taskService.datetime.integration.test.ts` (fromCompletion, until), validation test
- [ ] 2.5 MCP: recurrence input `from_completion`, `until` in `api/src/mcp/tools/*`; `datePrinter.ts` prints them; `resolve.test.ts`

## 3. pt-BR typed dates + parse endpoint (API, TDD)

- [ ] 3.1 `api/src/parsers/date.peggy`: hoje/amanhã/ontem, próxima/próximo <dia>, seg..dom full + short, em N dias/semanas/meses, `<d> de <mês>`, `dd/mm[/aaaa]`, `às HH:MM`, todo dia, toda <dia>, a cada N dias/semanas/meses; accents optional
- [ ] 3.2 Rebuild parser; cases in `dateParser.test.ts` (+ property test still green)
- [ ] 3.3 `GET /api/v1/dates/parse?q=` in `api/src/routes/dates.ts`; register in `routes/index.ts`; returns `{ date, time, recurrence }` or 404 `AppError`; user timezone `now`
- [ ] 3.4 Route test (session + token)

## 4. Frontend types and wiring

- [ ] 4.1 `app/src/types/task.ts`: `RecurrenceRule` (mirror API), `TaskSchedule.recurrenceRule: RecurrenceRule | null`
- [ ] 4.2 `taskDateMenuItem.tsx` `scheduleOf` includes `recurrenceRule`
- [ ] 4.3 Grep callers; `handleSetSchedule` in `DailyPage.tsx:370`, `InboxPage.tsx:357`, `CollectionsPage.tsx:375` send `recurrenceRule` (optimistic via `runOptimistic`)

## 5. Pure utils (TDD)

- [ ] 5.1 `app/src/utils/dateQuickOptions.ts`: today, tomorrow, weekend (next Sat; today if Sat), next week (next `weekStart` day); test
- [ ] 5.2 `app/src/utils/recurrenceSummary.ts`: rule -> localized sentence (en, pt-BR); test

## 6. Components

- [ ] 6.1 `app/src/components/ui/MonthCalendar.tsx` `{ value, onSelect, weekStart, minDate? }` extracted from `DatePickerSpecimen.tsx` (reuse `fmtISO`, `weekdayColumnIndex`, `weekdayInitials`); Specimen wraps it; `CalendarWeekStart.test.tsx` green
- [ ] 6.2 `TaskDatePickerPanel.tsx`: screen state `'date' | 'time' | 'repeat'`, single draft `TaskSchedule`, save only on Salvar
- [ ] 6.3 `ui/datePicker/DateScreen.tsx`: typed input (debounced `/dates/parse`, preview, Enter applies), quick options, calendar, Adicionar horário / Repetir / Prazo final, Remover data + Salvar
- [ ] 6.4 `ui/datePicker/TimeScreen.tsx`: back, start time (`CustomSelect` 15-min steps + free entry), duration select + `ButtonGroup` presets, end-time hint, deadline `Toggle` + date/time, Repetição row
- [ ] 6.5 `ui/datePicker/RepeatScreen.tsx`: `Radio` presets, custom interval/unit/weekday circles, `ButtonGroup` scheduled/completion, Nunca/Em uma data, summary, Cancelar/Salvar
- [ ] 6.6 Styling: Tailwind tokens, Lora, flat borders, overlay shadow on panel only, 24px rhythm, ~312px wide, viewport-clamped on mobile
- [ ] 6.7 i18n keys `datePicker.*`, `recurrence.*` in `en.ts`, `pt-BR.ts`, `types.ts`

## 7. Tests

- [ ] 7.1 Rewrite `TaskDatePickerPanel.test.tsx`: navigation, quick options, calendar, duration presets, deadline toggle, custom repeat, Remover data (await in `act`/`findBy*`)
- [ ] 7.2 `MonthCalendar` unit test
- [ ] 7.3 Update `app/e2e/taskDatetime.spec.ts` for new UI
- [ ] 7.4 E2E: "a cada 2 semanas, sábado, a partir da conclusão", complete task, assert next occurrence

## 8. Verification

- [ ] 8.1 `docker compose exec api npm test`, `docker compose exec app npm test`, lint + build both, `npm run test:e2e`
- [ ] 8.2 Playwright at `https://datepicker.planner.local`: Daily, Inbox, Collections; all 3 screens; no console errors
- [ ] 8.3 Desktop + 390px screenshots in `app/dist/screenshots/`, compare with mockups
- [ ] 8.4 Small Conventional Commits per step, push at milestones, mark PR ready
