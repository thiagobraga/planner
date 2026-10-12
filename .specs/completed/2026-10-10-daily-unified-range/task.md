# Tarefas: Daily unificado

Trabalho no worktree `../planner-daily-range` (branch `feat/daily-unified-range`, stack em `https://claude.planner.local`), TDD (teste primeiro, DB real), commits pequenos em Conventional Commits.

1. [x] Spec em `.specs/2026-10-10-daily-unified-range/` (`plan.md` + `task.md`)
2. [x] API
   1. [x] `dailyService.getDailyView(userId, from, to, now)` em `api/src/services/dailyService.ts`, com testes: intervalo de 1 e 7 dias, dias vazios presentes, overdue relativo a hoje, `hideCompletedTasks`, `showNotes`, coleção arquivada, ordem por `task_order`, fuso do usuário
   2. [x] Rota `GET /daily/:from/:to` com regex de formato. Validar data real, `from <= to`, máx. 42 dias. Testes de rota: 404 de formato, 400 de intervalo
   3. [x] Montar em `routes/index.ts` (somente leitura, `publishEvent` não se aplica)
   4. [x] MCP `get_today` e `get_upcoming` (`api/src/mcp/tools/views.ts`) apontam para o novo serviço, com testes MCP
   5. [x] Remover `/views/today|upcoming|month`, `getTodayView|getUpcomingView|getMonthView` e os testes mortos
3. [x] App: cliente e hook
   1. [x] `fetchDaily(from, to)` em `app/src/api/client.ts`. Remover `fetchTodayTasks|fetchUpcomingTasks|fetchMonthNotes` e atualizar `client.test.ts` e `client.added.test.ts`
   2. [x] `useDailyTasks(from, to)` com testes (chave de cache, invalidação por sync com debounce)
   3. [x] Helper puro `dailyRange(view, anchor, weekStart, showNextDays)` com testes (list 1 e 7 dias, semana, grade do mês)
4. [x] App: rotas e views
   1. [x] `App.tsx`: `/daily` redireciona para a última view. Rotas `/daily/list|kanban|cards|monthly`. View inválida cai em `/daily/list`
   2. [x] `ViewSwitcher` na Daily navega por rota. Salvar a última view só para o redirect
   3. [x] Extrair `DailyList` e ligar `DailyWeekBoard` e `MonthlyView` ao hook. Apagar `replaceTodayFromApi`, `fetchUpcomingFromApi`, `rawTodayRef`, `loadRequestId`, `upcomingSections`
   4. [x] Ajustar links e atalhos para `/daily` (`Sidebar.tsx:116`, `AppShell.tsx:168,177`)
5. [x] Testes
   1. [x] Reescrever os mocks de `DailyPage*.test.tsx` para o novo cliente
   2. [x] E2E Playwright: cada rota mostra a view certa, navegar de semana busca o intervalo, o Network mostra um único `GET /daily/..` por carga e nenhum `/views/collection/*`
6. [x] Docs: `CLAUDE.md` (rotas, API Reference, Pages & Routes) e `README.md`
7. [x] Verificação visual: abrir cada rota no navegador (desktop e estreito), checar o console e salvar screenshots em `app/dist/screenshots/`

## Verificação ponta a ponta

- `docker compose exec api npm test` e `docker compose exec app npm test` verdes. `npm run lint` e `tsc --noEmit` sem erros
- `docker compose exec app npm run test:e2e` nos specs de Daily
- Manual: em `/daily/kanban`, o Network mostra uma chamada `GET /api/v1/daily/<seg>/<dom>`. Trocar de semana gera outra chamada só do novo intervalo. Criar ou mover tarefa não dispara rajada
- `curl` com token: `/api/v1/daily/2026-10-05/2026-10-11` (200), `/api/v1/daily/2026-10-05/abc` (404), intervalo de 60 dias (400)
