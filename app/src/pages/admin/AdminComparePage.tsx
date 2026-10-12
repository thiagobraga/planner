import { useI18n } from '../../i18n/I18nContext';

interface Feature {
  key: string;
  category: string;
  planner: 'yes' | 'no' | 'partial' | 'unknown';
  todoist: 'yes' | 'no' | 'partial' | 'unknown';
  habitica: 'yes' | 'no' | 'partial' | 'unknown';
  microsoftTodo: 'yes' | 'no' | 'partial' | 'unknown';
  googleTasks: 'yes' | 'no' | 'partial' | 'unknown';
  rememberTheMilk: 'yes' | 'no' | 'partial' | 'unknown';
  jira: 'yes' | 'no' | 'partial' | 'unknown';
}

interface Column {
  id: string;
  header: string;
  key: keyof Feature;
}

const COLUMNS: Column[] = [
  { id: 'planner', header: 'Planner', key: 'planner' },
  { id: 'todoist', header: 'Todoist', key: 'todoist' },
  { id: 'habitica', header: 'Habitica', key: 'habitica' },
  { id: 'microsoftTodo', header: 'Microsoft To Do', key: 'microsoftTodo' },
  { id: 'googleTasks', header: 'Google Tasks', key: 'googleTasks' },
  { id: 'rememberTheMilk', header: 'Remember the Milk', key: 'rememberTheMilk' },
  { id: 'jira', header: 'Jira', key: 'jira' },
];

const FEATURES: Feature[] = [
  { key: 'tasks', category: 'Core Task Management', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'subtasks', category: '', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'partial', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'dueDates', category: '', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'deadlines', category: '', planner: 'yes', todoist: 'yes', habitica: 'no', microsoftTodo: 'yes', googleTasks: 'no', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'priority', category: '', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'no', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'labels', category: '', planner: 'yes', todoist: 'yes', habitica: 'no', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'filters', category: '', planner: 'yes', todoist: 'yes', habitica: 'no', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'search', category: '', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'comments', category: '', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'attachments', category: '', planner: 'no', todoist: 'yes', habitica: 'no', microsoftTodo: 'yes', googleTasks: 'no', rememberTheMilk: 'yes', jira: 'yes' },

  { key: 'habits', category: 'Habit Tracking', planner: 'yes', todoist: 'no', habitica: 'yes', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'no', jira: 'no' },
  { key: 'habitStreaks', category: '', planner: 'yes', todoist: 'no', habitica: 'yes', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'no', jira: 'no' },
  { key: 'habitGroups', category: '', planner: 'yes', todoist: 'no', habitica: 'yes', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'no', jira: 'no' },
  { key: 'habitCalendar', category: '', planner: 'yes', todoist: 'no', habitica: 'yes', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'no', jira: 'no' },

  { key: 'collections', category: 'Projects & Collections', planner: 'yes', todoist: 'yes', habitica: 'no', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'subCollections', category: '', planner: 'yes', todoist: 'no', habitica: 'no', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'no', jira: 'yes' },
  { key: 'sections', category: '', planner: 'yes', todoist: 'yes', habitica: 'no', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'no', jira: 'yes' },
  { key: 'kanban', category: '', planner: 'yes', todoist: 'yes', habitica: 'no', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'no', jira: 'yes' },
  { key: 'boardViews', category: '', planner: 'yes', todoist: 'yes', habitica: 'no', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'no', jira: 'yes' },

  { key: 'recurrence', category: 'Recurring Tasks', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'dailyRecurrence', category: '', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'weeklyRecurrence', category: '', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'monthlyRecurrence', category: '', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'yearlyRecurrence', category: '', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'no', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'customRecurrence', category: '', planner: 'no', todoist: 'yes', habitica: 'no', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'yes', jira: 'yes' },

  { key: 'reminders', category: 'Reminders & Notifications', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'pushNotifications', category: '', planner: 'no', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'emailReminders', category: '', planner: 'no', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'locationReminders', category: '', planner: 'no', todoist: 'yes', habitica: 'no', microsoftTodo: 'yes', googleTasks: 'no', rememberTheMilk: 'yes', jira: 'no' },

  { key: 'collaboration', category: 'Collaboration', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'sharedProjects', category: '', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'taskAssignment', category: '', planner: 'no', todoist: 'yes', habitica: 'no', microsoftTodo: 'yes', googleTasks: 'no', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'collabComments', category: '', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'activityFeed', category: '', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'no', jira: 'yes' },

  { key: 'api', category: 'Integrations & API', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'partial', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'mcp', category: '', planner: 'yes', todoist: 'no', habitica: 'no', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'no', jira: 'no' },
  { key: 'oauth', category: '', planner: 'yes', todoist: 'yes', habitica: 'no', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'webhooks', category: '', planner: 'no', todoist: 'yes', habitica: 'no', microsoftTodo: 'yes', googleTasks: 'no', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'zapier', category: '', planner: 'no', todoist: 'yes', habitica: 'no', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'ifttt', category: '', planner: 'no', todoist: 'yes', habitica: 'no', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'no' },

  { key: 'web', category: 'Platforms', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'ios', category: '', planner: 'no', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'android', category: '', planner: 'no', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'yes' },
  { key: 'macos', category: '', planner: 'no', todoist: 'yes', habitica: 'no', microsoftTodo: 'yes', googleTasks: 'no', rememberTheMilk: 'no', jira: 'yes' },
  { key: 'windows', category: '', planner: 'no', todoist: 'yes', habitica: 'no', microsoftTodo: 'yes', googleTasks: 'no', rememberTheMilk: 'no', jira: 'yes' },
  { key: 'linux', category: '', planner: 'no', todoist: 'no', habitica: 'no', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'no', jira: 'no' },
  { key: 'pwa', category: '', planner: 'yes', todoist: 'no', habitica: 'no', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'no', jira: 'no' },
  { key: 'offline', category: '', planner: 'yes', todoist: 'yes', habitica: 'no', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'no' },

  { key: 'freeTier', category: 'Pricing', planner: 'yes', todoist: 'yes', habitica: 'yes', microsoftTodo: 'yes', googleTasks: 'yes', rememberTheMilk: 'yes', jira: 'no' },
  { key: 'selfHosted', category: '', planner: 'yes', todoist: 'no', habitica: 'no', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'no', jira: 'yes' },
  { key: 'openSource', category: '', planner: 'yes', todoist: 'no', habitica: 'yes', microsoftTodo: 'no', googleTasks: 'no', rememberTheMilk: 'no', jira: 'no' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pb-6">
      <h2 className="text-sm leading-6 font-semibold text-ink h-6">{title}</h2>
      <div className="h-6" />
      {children}
    </section>
  );
}

function StatusCell({ value }: { value: 'yes' | 'no' | 'partial' | 'unknown' }) {
  const styles = {
    yes: 'bg-moss/20 text-moss',
    no: 'bg-accent/12 text-accent',
    partial: 'bg-priority-2/20 text-priority-2',
    unknown: 'bg-dot/40 text-ink-light',
  };

  const labels = {
    yes: '✓',
    no: '✗',
    partial: '~',
    unknown: '?',
  };

  const tooltips = {
    yes: 'Yes',
    no: 'No',
    partial: 'Partial',
    unknown: 'Unknown',
  };

  return (
    <td className="px-3 py-2 text-center">
      <span
        className={`inline-flex items-center justify-center w-8 h-8 rounded-[6px] text-[13px] leading-none font-medium ${styles[value]}`}
        title={tooltips[value]}
      >
        {labels[value]}
      </span>
    </td>
  );
}

function CategoryRow({ title, colSpan }: { title: string; colSpan: number }) {
  return (
    <tr className="bg-dot/30">
      <th className="px-3 py-3 text-left text-[11px] uppercase tracking-widest text-ink-light font-semibold sticky top-0 z-10 bg-cream border-r border-dot" colSpan={colSpan}>
        {title}
      </th>
    </tr>
  );
}

function TableHeader() {
  return (
    <thead>
      <tr className="border-b border-dot">
        <th className="px-3 py-3 text-left text-[11px] uppercase tracking-widest text-ink-light font-semibold sticky left-0 z-20 bg-cream border-r border-dot w-64 min-w-64">
          Feature
        </th>
        {COLUMNS.map((col) => (
          <th key={col.id} className="px-3 py-3 text-center text-[11px] uppercase tracking-widest text-ink-light font-semibold sticky top-0 z-10 bg-cream border-b border-dot">
            {col.header}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TableBody({ featureLabels, categoryLabels }: { featureLabels: Record<string, string>; categoryLabels: Record<string, string> }) {
  const rows: React.ReactNode[] = [];
  let currentCategory = '';

  FEATURES.forEach((feature) => {
    const showCategory = feature.category && feature.category !== currentCategory;
    if (showCategory) currentCategory = feature.category;

    rows.push(
      <React.Fragment key={feature.key}>
        {showCategory && <CategoryRow title={categoryLabels[feature.category] || feature.category} colSpan={COLUMNS.length + 1} />}
        <tr className="border-b border-dot/50 hover:bg-dot/20">
          <td className="px-3 py-2 text-sm leading-6 text-ink sticky left-0 z-10 bg-cream border-r border-dot w-64 min-w-64">
            {featureLabels[feature.key] || feature.key}
          </td>
          {COLUMNS.map((col) => (
            <StatusCell key={col.id} value={feature[col.key]} />
          ))}
        </tr>
      </React.Fragment>
    );
  });

  return <tbody>{rows}</tbody>;
}

function Legend({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-dot text-[12px] leading-6 text-ink-light">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-6 h-6 rounded-[6px] bg-moss/20 text-moss inline-flex items-center justify-center text-[11px] font-medium">✓</span>
        {t('compare.legend.yes')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-6 h-6 rounded-[6px] bg-accent/12 text-accent inline-flex items-center justify-center text-[11px] font-medium">✗</span>
        {t('compare.legend.no')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-6 h-6 rounded-[6px] bg-priority-2/20 text-priority-2 inline-flex items-center justify-center text-[11px] font-medium">~</span>
        {t('compare.legend.partial')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-6 h-6 rounded-[6px] bg-dot/40 text-ink-light inline-flex items-center justify-center text-[11px] font-medium">?</span>
        {t('compare.legend.unknown')}
      </span>
    </div>
  );
}

export function AdminComparePage() {
  const { t } = useI18n();

  const featureLabels: Record<string, string> = {};
  FEATURES.forEach((f) => {
    featureLabels[f.key] = t(`compare.features.${f.key}`) || f.key;
  });

  const categoryLabels: Record<string, string> = {};
  const categories = [...new Set(FEATURES.map((f) => f.category).filter(Boolean))];
  categories.forEach((c) => {
    categoryLabels[c] = t(`compare.categories.${c}`) || c;
  });

  return (
    <div className="admin-compare-page w-full max-w-full">
      <header className="page-header-copy sticky-page-header max-w-162">
        <div className="page-header-copy-text">
          <h1 className="m-0 h-6 p-0 text-lg leading-6 font-semibold text-ink">
            {t('admin.compareTitle')}
          </h1>
          <p className="page-header-subtitle m-0 h-6 p-0 text-[13px] leading-6 text-ink-light opacity-60">
            {t('admin.compareSubtitle')}
          </p>
        </div>
      </header>

      <div className="h-6" />

      <Section title={t('admin.compareTableTitle')}>
        <div className="overflow-x-auto border border-dot rounded-[8px]">
          <table className="w-full min-w-[1100px] border-collapse">
            <TableHeader />
            <TableBody featureLabels={featureLabels} categoryLabels={categoryLabels} />
          </table>
        </div>
        <Legend t={t} />
      </Section>

      <Section title={t('admin.compareNotesTitle')}>
        <div className="prose prose-ink max-w-none text-sm leading-6 text-ink-light">
          <p>{t('admin.compareNote1')}</p>
          <p>{t('admin.compareNote2')}</p>
          <p>{t('admin.compareNote3')}</p>
        </div>
      </Section>
    </div>
  );
}