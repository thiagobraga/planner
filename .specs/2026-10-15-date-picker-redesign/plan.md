# Date Picker Redesign

## What

The "Set date" entry in the task context menu (Daily, Inbox, Collections) currently opens a small form of native date/time/number inputs. Replace it with a three-screen picker in the paper-journal style, matching the ChatGPT mockups (Definir data, Horário e prazo, Repetir).

## User flows

### 1. Definir data (root screen)

- Header with calendar icon, "Definir data" title and close button.
- Text field "Digite uma data..." - I can type `amanhã`, `próxima sexta`, `em 3 dias`, `17/10`, `todo sábado` (or the English equivalents). A preview of the parsed date appears; Enter applies it.
- Quick options with the resolved date on the right:
  - Hoje - Qui, 15 out
  - Amanhã - Sex, 16 out
  - Este fim de semana - next Saturday
  - Próxima semana - next week-start day
- Month calendar with previous/next arrows. Today is ringed; the selected day is a filled ink circle. Respects my week-start preference.
- "Adicionar horário" button (shows the time once set) and "Repetir" button (shows the recurrence summary once set).
- "Prazo final" row with "Adicionar" or the current deadline.
- Footer: "Remover data" clears date, time, duration, deadline and recurrence. "Salvar" saves everything at once.

### 2. Horário e prazo

- Back arrow, title, close. Selected date shown as a header ("Sábado, 17 de outubro").
- HORÁRIO: start time and duration. Duration presets 15 min / 30 min / 1 h / 2 h. Hint "Termina às 09:30".
- PRAZO FINAL: toggle "Definir prazo final" reveals deadline date and time. Note: "A data planejada e o prazo são independentes."
- Repetição row showing the current rule ("Não repetir") and opening screen 3.

### 3. Repetir

- Presets: Não repetir, Todos os dias, Toda semana no <dia da data>, Dias úteis (seg-sex), Personalizar.
- Personalizar:
  - FREQUÊNCIA: "A cada [N] [dias|semanas|meses|anos]"; weekday circles (D S T Q Q S S) for weekly.
  - CONTAR A PARTIR DE: Data agendada | Conclusão. With Conclusão, the next occurrence is counted from the day I complete the task.
  - TERMINA: Nunca | Em uma data. After the end date, completing the task does not create another occurrence.
- Summary line: "A cada 2 semanas, aos sábados".
- Cancelar returns without changes; Salvar keeps the rule in the draft.

### Agents

MCP `create_task` / `update_task` accept the new recurrence options (`from_completion`, `until`), and task listings print them.

## Design rules

Lora only, cream/ink palette, flat 1px borders, overlay shadow only on the panel, 24px rhythm, no blue, no pure white/black. Panel ~312px wide; on narrow screens it fits inside the viewport with a 16px gutter.

## Out of scope

- `TaskDetail.tsx` (not mounted anywhere) stays untouched; flag as dead code in the PR.

## Relevant Files

**API**
- `api/src/engines/recurrenceEngine.ts` - `RecurrenceRule`, `computeNextOccurrence`
- `api/src/services/taskService.ts` - `completeTask` recurring clone
- `api/src/utils/taskValidation.ts` - add recurrence validation
- `api/src/parsers/date.peggy`, `api/src/parsers/dateParser.ts`, `api/src/parsers/datePrinter.ts`
- `api/src/routes/dates.ts` (new), `api/src/routes/index.ts`
- `api/src/types/` - shared `RecurrenceRule` type
- `api/src/mcp/tools/*` - recurrence input
- Tests: `api/src/engines/__tests__/recurrenceEngine.test.ts`, `api/src/parsers/__tests__/dateParser.test.ts`, `api/src/services/__tests__/taskService.datetime.integration.test.ts`, `api/src/routes/__tests__/`

**App**
- `app/src/components/ui/TaskDatePickerPanel.tsx` - screen router
- `app/src/components/ui/datePicker/DateScreen.tsx`, `TimeScreen.tsx`, `RepeatScreen.tsx` (new)
- `app/src/components/ui/MonthCalendar.tsx` (new, extracted from `components/monthly/DatePickerSpecimen.tsx`)
- `app/src/components/taskDateMenuItem.tsx` - `scheduleOf`
- `app/src/types/task.ts` - `TaskSchedule.recurrenceRule`, `RecurrenceRule`
- `app/src/utils/dateQuickOptions.ts`, `app/src/utils/recurrenceSummary.ts` (new)
- `app/src/pages/DailyPage.tsx`, `InboxPage.tsx`, `CollectionsPage.tsx` - `handleSetSchedule`
- `app/src/i18n/locales/en.ts`, `app/src/i18n/locales/pt-BR.ts`, `app/src/i18n/types.ts`
- Tests: `app/src/components/ui/__tests__/TaskDatePickerPanel.test.tsx`, `app/src/components/__tests__/CalendarWeekStart.test.tsx`, `app/e2e/taskDatetime.spec.ts`
