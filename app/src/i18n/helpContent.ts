import type { Locale } from './I18nContext';

interface HelpSection {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
}

interface HelpContent {
  title: string;
  subtitle: string;
  onThisPage: string;
  then: string;
  sections: HelpSection[];
  shortcutsTitle: string;
  shortcuts: Array<{ keys: string[]; label: string }>;
}

const english: HelpContent = {
  title: 'Help',
  subtitle: 'Learn how to use Planner',
  onThisPage: 'On This Page',
  then: 'then',
  sections: [
    {
      id: 'welcome',
      title: 'Welcome',
      paragraphs: ['Planner is a Bullet Journal-inspired task manager designed to help you organize your day with focus and clarity. It supports daily planning, habit tracking, collections, and works offline.'],
    },
    {
      id: 'getting-started',
      title: 'Getting Started',
      items: [
        "Creating tasks: Type in the task input at the bottom of any page and press Enter. Use the Quick Add shortcut (Q) for natural-language dates, such as 'tomorrow' or 'next Monday'.",
        'Completing tasks: Click the bullet to mark a task done. It becomes × with a line-through.',
        'Editing: Click any task to edit inline. Press Enter to save or Esc to cancel.',
        'Task types: Tasks show a • bullet. Notes show a – dash; press - in an empty input to create one.',
      ],
    },
    {
      id: 'views',
      title: 'Views',
      items: [
        "Daily: Your daily page. Shows today's tasks plus overdue items, grouped by date.",
        'Inbox: The default capture spot for tasks not yet assigned to a collection.',
        'Monthly: A ledger-style month view. Each day is a row showing its date and notes.',
        'Upcoming: Toggle on the Daily page for a seven-day lookahead of what\'s scheduled next.',
      ],
    },
    {
      id: 'habits',
      title: 'Habits',
      items: [
        'Track daily habits in Timeline view or Calendar view.',
        'Click a dot to log completion. Consecutive days form an unbroken chain connected by a visible line.',
        'Organize habits into groups and nest sub-habits under parent habits.',
      ],
    },
    {
      id: 'collections',
      title: 'Collections & Tags',
      items: [
        'Create collections to group related tasks. Collections can be nested up to four levels deep.',
        'Drag tasks onto collections in the sidebar to file them.',
        'Add @label tags to classify tasks.',
      ],
    },
    {
      id: 'settings',
      title: 'Settings',
      items: [
        'Choose the app language and how your calendar handles time zones and week starts.',
        'Choose your font, toggle the dot-grid background, switch between beige and white, or enable small caps.',
      ],
    },
  ],
  shortcutsTitle: 'Keyboard Shortcuts',
  shortcuts: [
    { keys: ['Q'], label: 'Quick add task' },
    { keys: ['/'], label: 'Search' },
    { keys: ['?'], label: 'Toggle help dialog' },
    { keys: ['G', 'I'], label: 'Go to Inbox' },
    { keys: ['G', 'D'], label: 'Go to Daily' },
    { keys: ['G', 'M'], label: 'Go to Monthly' },
    { keys: ['G', 'H'], label: 'Go to Habits' },
    { keys: ['G', 'S'], label: 'Go to Settings' },
    { keys: ['G', 'U'], label: 'Toggle Upcoming' },
    { keys: ['↑', '↓'], label: 'Navigate tasks' },
    { keys: ['Enter'], label: 'Edit selected task' },
    { keys: ['Space'], label: 'Toggle completion' },
    { keys: ['Tab'], label: 'Indent task' },
    { keys: ['Esc'], label: 'Close dialog' },
  ],
};

const portugueseBrazil: HelpContent = {
  title: 'Ajuda',
  subtitle: 'Aprenda a usar o Planner',
  onThisPage: 'Nesta página',
  then: 'depois',
  sections: [
    {
      id: 'welcome',
      title: 'Boas-vindas',
      paragraphs: ['O Planner é um gerenciador de tarefas inspirado no Bullet Journal para organizar seu dia com foco e clareza. Ele oferece planejamento diário, acompanhamento de hábitos, coleções e funcionamento offline.'],
    },
    {
      id: 'getting-started',
      title: 'Primeiros passos',
      items: [
        "Criar tarefas: Digite no campo de tarefas no fim de qualquer página e pressione Enter. Use o atalho de adição rápida (Q) para datas em linguagem natural, como 'amanhã' ou 'próxima segunda-feira'.",
        'Concluir tarefas: Clique no marcador para concluir uma tarefa. Ele vira × e o texto fica riscado.',
        'Editar: Clique em uma tarefa para editar. Pressione Enter para salvar ou Esc para cancelar.',
        'Tipos de item: Tarefas usam o marcador •. Notas usam –; pressione - em um campo vazio para criar uma.',
      ],
    },
    {
      id: 'views',
      title: 'Visualizações',
      items: [
        'Diário: Mostra as tarefas de hoje e itens atrasados, agrupados por data.',
        'Caixa de entrada: Local padrão para capturar tarefas ainda sem coleção.',
        'Mensal: Visão do mês em formato de registro, com datas e notas.',
        'Próximas: Alternável na página Diário, mostra os próximos sete dias agendados.',
      ],
    },
    {
      id: 'habits',
      title: 'Hábitos',
      items: [
        'Acompanhe hábitos na linha do tempo ou no calendário.',
        'Clique em um ponto para registrar a conclusão. Dias consecutivos formam uma corrente visível.',
        'Organize hábitos em grupos e aninhe sub-hábitos.',
      ],
    },
    {
      id: 'collections',
      title: 'Coleções e etiquetas',
      items: [
        'Crie coleções para agrupar tarefas relacionadas. Elas podem ter até quatro níveis.',
        'Arraste tarefas para coleções na barra lateral para organizá-las.',
        'Adicione etiquetas como @etiqueta para classificar tarefas.',
      ],
    },
    {
      id: 'settings',
      title: 'Configurações',
      items: [
        'Escolha o idioma e como o calendário lida com fuso horário e início da semana.',
        'Escolha a fonte, alterne os pontos do fundo, use bege ou branco e ative versaletes.',
      ],
    },
  ],
  shortcutsTitle: 'Atalhos do teclado',
  shortcuts: [
    { keys: ['Q'], label: 'Adicionar tarefa rapidamente' },
    { keys: ['/'], label: 'Buscar' },
    { keys: ['?'], label: 'Alternar ajuda' },
    { keys: ['G', 'I'], label: 'Ir para a Caixa de entrada' },
    { keys: ['G', 'D'], label: 'Ir para o Diário' },
    { keys: ['G', 'M'], label: 'Ir para o Mensal' },
    { keys: ['G', 'H'], label: 'Ir para Hábitos' },
    { keys: ['G', 'S'], label: 'Ir para Configurações' },
    { keys: ['G', 'U'], label: 'Alternar Próximas' },
    { keys: ['↑', '↓'], label: 'Navegar pelas tarefas' },
    { keys: ['Enter'], label: 'Editar tarefa selecionada' },
    { keys: ['Space'], label: 'Alternar conclusão' },
    { keys: ['Tab'], label: 'Recuar tarefa' },
    { keys: ['Esc'], label: 'Fechar janela' },
  ],
};

export const helpContent: Record<Locale, HelpContent> = {
  en: english,
  'pt-BR': portugueseBrazil,
};
