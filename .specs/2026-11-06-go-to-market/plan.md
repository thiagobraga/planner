# Plano de marketing e vendas

Status: proposta, ainda não implantada. O domínio será https://bulletplanner.org e a implantação está prevista para breve. A produção rodará em um cluster Kubernetes em compute ARM A1 do OCI Always Free. Preço definido pelo Thiago: $2/mês ou $12/ano, com 10 dias de teste. Código aberto ou fechado ainda precisa de decisão.

## Objetivo

Levar o Planner de projeto pessoal a produto com usuários pagantes. A pessoa poderá usar direto no browser sem login, levar as tasks para a conta ao logar, ou hospedar por conta própria.

O maior risco é falta de distribuição e de um motivo claro para trocar de app, não falta de recurso. Por isso a divulgação começa agora, e o acesso abre por etapas conforme o produto fica confiável.

## Preço

Preços em USD para uso individual, conferidos em 2026-11-06.

| Produto                | Grátis                  | Mensal        | Anual         | Observação                          |
| ---------------------- | ----------------------- | ------------- | ------------- | ----------------------------------- |
| **Planner (proposto)** | Sem conta e self-host   | **$2**        | **$12**       | 10 dias de teste, código aberto     |
| Tasks.org Cloud        | App Android             | Não verificado | $29,99       | Assinatura a partir de $0,99/ano, sem a nuvem |
| Habitica               | Sim                     | $5            | $48           | Hábitos com jogo de RPG             |
| TickTick Premium       | 9 listas, 99 tasks cada | Não listado   | $49,99        | Página oficial só mostra o anual    |
| Todoist Pro            | 5 projetos              | $7            | $60           | Tem MCP                             |
| Vikunja Cloud          | Self-host               | €4            | €40           | AGPL, 14 dias de teste              |
| Microsoft Planner      | Não confirmado          | -             | $120          | Plan 1, $10/usuário/mês, para empresas |
| Microsoft To Do        | Tudo, conta pessoal     | -             | -             | Grátis                              |
| init.Tasks             | Grátis no beta          | Não divulgado | Não divulgado | Beta privado, ver abaixo            |

$12/ano é o menor plano anual com nuvem da tabela. Preço sozinho não vence: Microsoft To Do é grátis, e Todoist e TickTick têm plano grátis com sync.

**init.Tasks é o concorrente mais próximo:** visual forte (terminal, 23 temas), MCP, offline first, apps nativos e dev solo que adiciona cada pessoa à mão. O site não menciona código aberto nem self-host, que passam a ser a diferença mais clara.

### Conta com a taxa

Paddle cobra 5% + $0,50 por transação. O valor é antes dos impostos e da infra.

| Plano     | Preço | Taxa          | Líquido por ano                |
| --------- | ----- | ------------- | ------------------------------ |
| Mensal    | $2    | $0,60 (30%)   | $16,80, com 12 meses de assinatura |
| Anual     | $12   | $1,10 (9,2%)  | $10,90                         |

- Mesmo com taxa maior, o mensal rende mais que o anual a partir do 8º mês. O anual só ganha de quem cancelaria antes disso.
- O desconto de 50% no anual é bem maior que o do mercado (Habitica 20%, Vikunja 17%, Todoist 29%).
- 100 assinantes rendem $91/mês no anual ou $140/mês no mensal. $1.000/mês exige cerca de 1.100 anuais ou 715 mensais.
- Convertendo 2-5% (estimativa, não medição), 100 assinantes exigem 2.000-5.000 pessoas testando.
- Só cobrar depois que o beta passar pelo critério da etapa 3.

### Meio de pagamento

Recomendação: **Paddle**.

- **Paddle:** cuida dos impostos internacionais e o Brasil não está na lista de países bloqueados. Falta confirmar na abertura da conta como o dinheiro chega ao Brasil.
- **Lemon Squeezy:** o Brasil não está na lista de pagamento bancário, só PayPal, e a empresa quer levar os clientes para o Stripe Managed Payments.
- **Stripe Managed Payments:** o Brasil não aparece na página de elegibilidade.
- Falar com um contador antes da primeira cobrança.

## O que é grátis e o que é pago

| Plano     | Preço                           | Inclui                                   |
| --------- | ------------------------------- | ---------------------------------------- |
| Sem conta | Grátis                          | Tudo local, só naquele navegador         |
| Self-host | Grátis                          | Tudo; a pessoa cuida do próprio servidor |
| Nuvem     | $2/mês ou $12/ano, 10 dias de teste | Sync, backup, MCP e colaboração      |

Se a pessoa parar de pagar, os dados continuam exportáveis.

## Promessa ao usuário

Sem letra miúda e com um humano do outro lado. No site, prometer só o que dá para cumprir sempre; "zero problemas" fica como meta interna.

- Preço e regras do teste visíveis antes do cadastro.
- Cancelamento em um clique, nas configurações.
- Exportação dos dados a qualquer momento, inclusive depois de cancelar.
- Email respondido pelo Thiago, com prazo de resposta publicado.

O suporte pessoal é a vantagem contra empresas grandes, mas é o maior custo a este preço: um assinante anual rende $10,90 por ano. Com 1.100 assinantes, se 10% escreverem por mês (suposição), são 110 emails mensais. Revisar a promessa antes de chegar nesse volume.

## Código aberto ou fechado

Recomendação: **manter aberto e trocar MIT por AGPL antes do lançamento**, como Plausible e Vikunja. Quem oferecer uma versão modificada como serviço precisa publicar o código.

Fechar resolve um problema que ainda não existe: o repositório tem 1 estrela e 0 forks, então o risco atual é ninguém conhecer o Planner, não alguém copiar.

- **Distribuição:** Show HN, r/selfhosted e awesome-selfhosted são os primeiros canais, e os dois últimos dependem de self-host ou código aberto.
- **Diferencial:** é o que separa o Planner do init.Tasks, do TickTick e do Todoist.
- **Confiança:** se o projeto de uma pessoa só acabar, o usuário continua com o app.
- **Pouca margem para clone:** a $2/mês sobra pouco espaço para vender mais barato, e quem hospeda por conta própria dificilmente pagaria de qualquer forma.
- **Reversível:** o Thiago é o único autor humano e pode fechar versões futuras depois. Para manter essa opção, pedir CLA a quem contribuir.
- **Limite:** o código já publicado continua MIT, inclusive se o repositório for fechado.
- **Quando rever:** se uma cópia hospedada tirar clientes, ou se o público deixar de ser dev e self-hoster.

O site cita MIT e precisa acompanhar a mudança.

## Onde guardar informações do negócio

Recomendação: **repositório privado separado**, `planner-private`, fora desta pasta.

- **Repositório público:** código e specs do produto.
- **Repositório privado:** este plano, preço, finanças, contatos do beta e pendências de segurança. Este documento lista falhas abertas e a falta de backup, e não deve ser público.
- **Só local não:** sem histórico e sem cópia se a máquina falhar.
- **Sem submodule:** exporia o nome e a URL do privado no repositório público.
- **Segredos e dados de clientes:** não entram em nenhum dos dois repositórios; continuam em variáveis de ambiente e no banco.

## Posicionamento

"Simples e cheio de recursos" todo app diz, e as duas coisas puxam em direções opostas. Mensagem proposta:

> Um bullet journal digital bonito, open source, que seu agente de IA também usa.

MCP sozinho não diferencia, porque Todoist e init.Tasks também têm. O diferencial é a combinação com visual e self-host.

Público inicial: devs, self-hosters e quem usa agentes de IA. Depois, quem faz bullet journal, atraído pelo visual.

## Etapas

Marketing não precisa esperar o produto ficar pronto; só o acesso aberto precisa.

### 1. Agora: começar a publicar

- Lista de espera no site.
- 3 posts por semana no X e no Threads, com o mesmo conteúdo: vídeos curtos do app e bastidores, incluindo bugs.
- Instagram quando o visual estiver estável.
- LinkedIn só se já houver rede lá.

### 2. Antes de qualquer usuário externo: não perder dados

Detalhe visual não bloqueia; perda de dados, sim. Não montar uma stack grande de observability agora.

- Backup automático, fora do servidor e com restauração testada.
- Rastreamento de erros e alerta de queda.
- Revisão dos alertas abertos do code scanning (3 críticos e 33 altos em 2026-11-06).
- Versão do Postgres definida e alinhada entre a futura produção e o ambiente local.
- Lista de bugs no GitHub, que hoje tem 0 issues abertas.

### 3. Beta fechado: 10-20 pessoas convidadas

Falar com cada pessoa e observar o uso.

**Critério para avançar:** a maioria ainda usa depois de 2 semanas. Se não usar, o problema é o produto, e marketing não resolve.

### 4. Antes do lançamento

- **Modo sem login:** é o melhor anúncio, porque a pessoa testa com um clique. A parte difícil é juntar os dados locais com a conta.
- **Self-host:** imagens publicadas, `compose` próprio e guia de atualização. O README hoje sobe o ambiente de dev.
- **Cobrança:** pagamento integrado e termos com cancelamento e reembolso.

### 5. Lançamento: um canal por vez

- Show HN e r/selfhosted, deixando claro o preço e que o projeto é próprio.
- r/bulletjournal, depois de participar da comunidade e conferir as regras.
- Diretórios de MCP e Product Hunt.
- awesome-selfhosted a partir de 2027-02-12: exige primeira release com mais de 4 meses, e a primeira tag (`v0.2.0`) é de 2026-10-12.

### 6. Depois: medir o funil

Visita → teste sem conta → volta na semana 2 → assinatura. A volta na semana 2 é o número principal.

## Pontos em aberto

- Horas por semana disponíveis e receita mensal que faria valer a pena. Definem o calendário.
- Idioma principal da divulgação: inglês, português ou os dois.
- Código aberto com AGPL ou fechado.
- Teste de 10 dias com ou sem cartão.
- Manter o anual em $12 ou reduzir o desconto.

## Relevant Files

- `LICENSE`, `README.md`, `api/package.json`, `app/package.json` - licença e instalação self-host
- `site/src/` - lista de espera, preços e menção à licença
- `compose.yml`, `compose.prod.yml`, `compose.prod.color.yml`, `scripts/` - configuração existente de Postgres, backup e self-host; a configuração Kubernetes de produção ainda precisa ser definida
- `api/src/index.ts`, `app/src/main.tsx` - rastreamento de erros
- `app/src/contexts/AuthContext.tsx`, `app/src/api/client.ts` - modo sem login
- `app/src/i18n/legal/` - termos e privacidade
- `api/src/routes/index.ts`, `api/src/services/`, `api/src/db/migrations/` - assinatura

## Checklist de execução

Status: não iniciado. Depende das decisões abaixo. Cada item de código segue o fluxo normal do projeto: worktree, TDD e PR.

### 1. Decisões

- [ ] Definir horas por semana e meta de receita mensal.
- [ ] Definir idioma principal da divulgação.
- [x] Definir preço: $2/mês e $12/ano.
- [ ] Revisar se o anual fica em $12: líquido de $10,90, contra $16,80 em 12 meses no mensal.
- [ ] Definir se o teste de 10 dias pede cartão.
- [ ] Aprovar planos: sem conta, self-host e nuvem com 10 dias de teste.
- [ ] Decidir código: manter aberto com AGPL (recomendado) ou fechar.
- [ ] Decidir onde guardar informações do negócio: repositório privado `planner-private` (recomendado).
  - [ ] Se aprovado, mover esta pasta para lá, sem commitar no repositório público.
- [ ] Escolher meio de pagamento: Paddle (recomendado).
  - [x] Confirmar taxas nas páginas oficiais: Paddle e Lemon Squeezy cobram 5% + $0,50.
  - [x] Verificar suporte ao Brasil: fora da lista de bloqueio do Paddle, só PayPal no Lemon Squeezy, ausente na elegibilidade do Stripe Managed Payments.
  - [ ] Confirmar na abertura da conta Paddle como o pagamento chega ao Brasil.
- [ ] Falar com contador sobre formalização e impostos.

### 2. Divulgação inicial

- [ ] Adicionar lista de espera em `site/src/`.
  - [ ] Escolher onde guardar os emails e atualizar `app/src/i18n/legal/` se a privacidade mudar.
- [ ] Criar perfis no X e no Threads.
- [ ] Publicar 3 posts por semana.
- [ ] Adicionar análise de visitas com foco em privacidade ao site.

### 3. Infraestrutura e confiabilidade

- [ ] Preparar a implantação de produção no cluster Kubernetes em compute ARM A1 do OCI Always Free.
  - [ ] Configurar DNS e HTTPS para `https://bulletplanner.org`.
  - [ ] Definir imagens compatíveis com ARM64, armazenamento persistente, segredos e procedimento de atualização e rollback.
  - [ ] Validar capacidade e disponibilidade dos recursos OCI antes de depender deles.
- [ ] Backup do banco.
  - [ ] Verificar a origem dos arquivos `prod-user-scoped-*` na pasta `backups/`, ignorada pelo Git. Não há `pg_dump` em `scripts/` nem em `compose.prod.yml`.
  - [ ] Automatizar o backup e enviar para fora do servidor.
  - [ ] Testar a restauração e documentar o passo a passo.
- [ ] Observabilidade mínima.
  - [ ] Adicionar rastreamento de erros em `api/src/index.ts` e `app/src/main.tsx`, sem credenciais nem dados de usuário nos eventos.
  - [ ] Adicionar alerta de queda em `/api/v1/health`.
- [ ] Revisar os alertas do code scanning: 3 críticos e 33 altos em 2026-11-06.
- [ ] Definir e alinhar a versão do Postgres na futura produção e no ambiente local. Em 2026-11-06, `compose.prod.yml` usava 18 e `compose.yml` usava 16, com edição local ainda não commitada.
- [ ] Verificar se a API ainda cai quando o Redis reinicia (nota de outubro, status atual desconhecido).
- [ ] Criar issues no GitHub para os bugs conhecidos e classificar: perda de dados, quebra de fluxo ou visual.
- [ ] Corrigir os bugs de perda de dados e quebra de fluxo.

### 4. Beta fechado

- [ ] Convidar 10-20 pessoas.
- [ ] Criar canal de feedback.
- [ ] Conversar com cada pessoa e registrar os problemas como issues.
- [ ] Medir quem ainda usa depois de 2 semanas.
- [ ] Decidir se avança: a maioria precisa continuar usando.

### 5. Preparação do lançamento

- [ ] Licença, se aprovada.
  - [ ] Atualizar `LICENSE`, `README.md` e o campo `license` nos `package.json`.
  - [ ] Atualizar as menções a MIT em `site/src/`.
  - [ ] Adicionar CLA para contribuições externas.
- [ ] Modo sem login. Escrever spec próprio antes de implementar.
  - [ ] Salvar tasks localmente sem sessão e permitir rotas sem login em `app/src/contexts/AuthContext.tsx` e `app/src/App.tsx`.
  - [ ] Avaliar reaproveitar a fila offline da PWA.
  - [ ] Importar os dados locais ao logar, sem sobrescrever nem perder dados da conta.
  - [ ] Publicar eventos com `publishEvent()` e registrar atividade com `recordActivity()` na importação.
- [ ] Self-host. Escrever spec próprio antes de implementar.
  - [ ] Publicar imagens versionadas.
  - [ ] Criar `compose` próprio para self-host, separado da infraestrutura de produção.
  - [ ] Documentar instalação, atualização e backup no `README.md`.
- [ ] Cobrança. Escrever spec próprio antes de implementar.
  - [ ] Criar migração, serviço e rotas de assinatura, com validação dos webhooks.
  - [ ] Liberar recursos da nuvem conforme o plano, sem limitar o self-host.
  - [ ] Adicionar teste de 10 dias e exportação após o fim da assinatura.
  - [ ] Adicionar cancelamento em um clique nas configurações.
  - [ ] Atualizar termos e privacidade em `app/src/i18n/legal/`, com cancelamento e reembolso.
- [ ] Definir o canal de contato direto e o prazo de resposta publicado.
- [ ] Atualizar `site/src/` com preços, planos, regras do teste, contato e a nova mensagem.
- [ ] Gravar vídeo curto de demonstração.

### 6. Lançamento

- [ ] Conferir as regras atuais de cada comunidade antes de publicar.
- [ ] Publicar um canal por vez e acompanhar os comentários.
  - [ ] Show HN
  - [ ] r/selfhosted
  - [ ] r/bulletjournal
  - [ ] Diretórios de MCP
  - [ ] Product Hunt
- [ ] Enviar ao awesome-selfhosted a partir de 2027-02-12.
- [ ] Iniciar Instagram quando o visual estiver estável.

### 7. Medição

- [ ] Medir o funil: visita, teste sem conta, volta na semana 2 e assinatura.
- [ ] Revisar os números todo mês.
- [ ] Comparar a conversão real com a estimativa de 2-5% e ajustar a meta.
