# Daily unificado: um request por intervalo + rotas /daily/<view>

## Contexto

A Daily carrega dados de formas diferentes por view. A List usa `/views/today` (e `/views/upcoming` com "próximos dias"). O Kanban chegou a buscar `/views/collection/<id>` de cada coleção, com N requests repetidos a cada evento de sync. O Monthly e a semana navegada só enxergam o que já foi carregado. A função central tem um nome confuso (`replaceTodayFromApi`) e o `DailyPage.tsx` passa de 1100 linhas.

Regra desejada: **o mesmo request em todas as views. A única diferença entre elas é a quantidade de dias exibida.**

Estado atual no `main` (não commitado): `replaceTodayFromApi` chama só `fetchTodayTasks()`. Isso removeu o fan-out, mas deixou o Kanban sem tarefas de dias futuros. Este spec corrige isso de forma definitiva.

## O que o usuário vê

| Rota | View | Dias pedidos |
| --- | --- | --- |
| `/daily` | redireciona para a última view usada (padrão `list`) | - |
| `/daily/list` | lista; 1 dia (hoje), ou 7 com "próximos dias" | hoje, ou hoje até hoje+6 |
| `/daily/kanban` | kanban em listas (hoje `kanban-list`) | semana visível |
| `/daily/cards` | kanban em cards (hoje `kanban`) | semana visível |
| `/daily/monthly` | calendário (hoje `calendar`) | grade do mês visível |

- Trocar de view pelo `ViewSwitcher` navega entre essas rotas. A URL passa a ser a fonte da view. A última escolhida fica salva só para o redirecionamento de `/daily`.
- Atrasadas aparecem sempre (coluna Migrate no Kanban, seção própria na lista), independente do intervalo.
- Navegar para outra semana ou mês busca aquele intervalo, sem ficar vazio.
- `/` e `/today` continuam redirecionando para `/daily`.

## API

Um endpoint, sem prefixo `/views`, com o intervalo no caminho:

```
GET /api/v1/daily/:from/:to        ex.: /api/v1/daily/2026-10-05/2026-10-11
```

**Por que caminho e não query string:** o intervalo identifica o recurso (a janela de dias pedida), então vai no path. Query string fica para filtros opcionais. Path ou query não mudam a superfície de ataque por si só. O que protege é a validação estrita:

- `:from` e `:to` com regex na rota (`\d{4}-\d{2}-\d{2}`). Formato inválido nem chega ao handler (404).
- Data real do calendário (rejeita `2026-02-31`), `from <= to` e no máximo 42 dias (cobre a grade do mês). Violação devolve `AppError` 400 `VALIDATION_ERROR` com `details`, no mesmo formato do `viewService`.
- Somente leitura, autenticado como as demais rotas. Token somente-leitura pode usar, pois é GET.

Resposta, igual para todas as views:

```ts
{
  from: string; to: string; today: string;      // today no fuso do usuário
  overdue: ApiTask[];                           // due_date < today, sempre presente
  days: { date: string; tasks: ApiTask[] }[];   // um item por dia do intervalo, vazio incluso
}
```

Respeita as preferências já usadas hoje (`hideCompletedTasks`, `showNotes`), a ordenação por `task_order` do dia com fallback em `order_value`, e deixa coleções arquivadas de fora. Hoje `/views/upcoming` ignora essas preferências. O novo endpoint passa a respeitar em todos os dias.

Remoções, sem shims: rotas `GET /views/today`, `/views/upcoming`, `/views/month` e as funções de cliente `fetchTodayTasks`, `fetchUpcomingTasks`, `fetchMonthNotes` (esta última já não tem chamador). Ficam `/views/inbox` e `/views/collection/:id`. As tools MCP `get_today` e `get_upcoming` passam a chamar o novo serviço, com a mesma saída para o agente.

## Frontend

- Um hook `useDailyTasks(from, to)` (React Query, chave `['daily', from, to]`) substitui `replaceTodayFromApi`, `fetchUpcomingFromApi`, `rawTodayRef`, `loadRequestId` e o estado `upcomingSections`.
- Cada view só calcula `from` e `to`. A transformação em seções por dia é uma função pura única (o `buildSections` atual, movido e simplificado).
- Sync: evento `task` invalida `['daily']` uma vez, com debounce curto, em vez de um refetch por evento. O patch otimista local continua para create, update e delete simples.
- `DailyPage.tsx` é dividido em `DailyPage` (rota, toolbar, hook) e componentes por view (`DailyList`, mais os existentes `DailyWeekBoard` e `MonthlyView`). Meta: nenhum arquivo novo acima de ~400 linhas.
- A view da Daily deixa de ser guardada por `useBoardPreferences('daily')`. A rota manda. Collections e Inbox seguem como estão.
- Bug resolvido de graça: `loadView` em `useBoardPreferences.ts:17` não restaura `calendar` (volta para `list` após reload). Com a view na URL, isso some na Daily.

## Fora de escopo

Collections, Inbox, Habits, mudanças visuais e paginação além de 42 dias.

## Relevant Files

- API: `api/src/routes/views.ts`, `api/src/routes/index.ts`, `api/src/services/viewService.ts` (mais um novo `dailyService.ts`), `api/src/mcp/tools/views.ts`, `api/src/routes/__tests__/views.test.ts`, `api/src/services/__tests__/viewService.test.ts`
- App: `app/src/App.tsx`, `app/src/pages/DailyPage.tsx`, `app/src/api/client.ts`, `app/src/hooks/useBoardPreferences.ts`, `app/src/components/ui/ViewSwitcher.tsx`, `app/src/components/Sidebar.tsx`, `app/src/components/AppShell.tsx`, `app/src/components/board/DailyWeekBoard.tsx`, `app/src/components/monthly/MonthlyView.tsx`, `app/src/types/board.ts`
- Testes: `app/src/pages/__tests__/DailyPage*.test.tsx`, `app/src/api/__tests__/client*.test.ts`, e2e `app/e2e/dailyKanban.spec.ts`, `toolbarControls.spec.ts`, `weekSelector.spec.ts`, `taskDatetime.spec.ts`, `darkTheme.spec.ts`
- Docs: `CLAUDE.md` (tabela de rotas e API Reference), `README.md:154`
