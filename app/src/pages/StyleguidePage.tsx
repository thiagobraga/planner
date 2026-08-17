import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Calendar, Trash2, Search, ListTodo, Kanban, EyeOff, FileClock } from 'lucide-react';
import { BjTask, MonthlyIcon, PlannerIcon } from '../components/Sidebar';
import { SidebarNavItem } from '../components/SidebarNavItem';
import { ChevronRight, Repeat2 } from 'lucide-react';
import { MonthlyCalendarSpecimen } from '../components/monthly/MonthlyCalendarSpecimen';
import { MonthSelector } from '../components/monthly/MonthSelector';
import { DatePickerSpecimen } from '../components/monthly/DatePickerSpecimen';
import { HabitSpecimen } from '../components/habits/HabitSpecimen';
import { Button } from '../components/ui/Button';
import { ButtonGroup } from '../components/ui/ButtonGroup';
import { Input } from '../components/ui/Input';
import { Checkbox } from '../components/ui/Checkbox';
import { Radio } from '../components/ui/Radio';
import { Toggle } from '../components/ui/Toggle';
import { Chip, CollectionChip } from '../components/ui/Chip';
import { StatusPill } from '../components/ui/StatusPill';
import { PriorityDot } from '../components/ui/PriorityDot';
import { ViewToolbar } from '../components/ui/ViewToolbar';
import { TaskRowSpecimen } from '../components/ui/TaskRowSpecimen';
import { CustomSelect } from '../components/ui/CustomSelect';
import { ContextMenu, ContextMenuItem } from '../components/ui/ContextMenu';
import { Briefcase, Calendar as CalendarIcon, Tag, ArrowUp, ArrowDown } from 'lucide-react';
import { fetchPreferences } from '../api/client';
import { BoardCard } from '../components/board/BoardCard';

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({
  title,
  span = false,
  children,
}: {
  title: string;
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`${span ? 'lg:col-span-2' : ''}`}>
      <h2 className="text-[11px] font-semibold text-ink uppercase tracking-widest">
        {title}
      </h2>
      {children}
    </section>
  );
}

const TYPE_SCALE = [
  { label: 'Display', spec: 'Lora 600 · 48px / 56px', className: 'text-[48px] leading-[56px] font-semibold' },
  { label: 'Heading', spec: 'Lora 600 · 22px / 28px', className: 'text-[22px] leading-[28px] font-semibold' },
  { label: 'Body', spec: 'Lora 400 · 16px / 24px', className: 'text-[16px] leading-6' },
  { label: 'Caption', spec: 'Lora 400 · 12px / 18px', className: 'text-[12px] leading-[18px] text-ink-light' },
  { label: 'Label', spec: 'Lora 500 · 11px / 16px', className: 'text-[11px] leading-4 font-medium uppercase tracking-widest' },
  { label: 'Mono', spec: 'Monospace · 12px / 16px', className: 'text-[12px] leading-4 font-mono' },
];

const COLLECTIONS = [
  { name: 'dev', color: '#7dbfb2' },
  { name: 'planner', color: '#d7db96' },
  { name: 'health', color: '#cbd376' },
  { name: 'senac', color: '#b97a3a' },
  { name: 'sociopata', color: '#c98079' },
];

const NAV_COLLECTIONS = [
  { name: 'dev', color: '#7dbfb2', depth: 0 },
  { name: 'openclaw', color: '#d7db96', depth: 1 },
  { name: 'planner', color: '#d7db96', depth: 1 },
  { name: 'health', color: '#cbd376', depth: 0 },
  { name: 'music', color: '#c98079', depth: 0 },
  { name: 'sociopata', color: '#d56b64', depth: 1 },
  { name: 'senac', color: '#b97a3a', depth: 0 },
  { name: 'tech', color: '#7ea2d6', depth: 0 },
  { name: 'ai', color: '#a6cfc5', depth: 1 },
] as const;

const NAV = [
  { label: 'Daily', Icon: BjTask, active: true },
  { label: 'Inbox', Icon: ChevronRight, active: false },
  { label: 'Monthly', Icon: MonthlyIcon, active: false },
  { label: 'Habits', Icon: Repeat2, active: false },
];

const SPACING = [4, 8, 16, 24, 32, 48];
const RADII = [4, 6, 8, 12, 16];
const MOTION = [
  { ms: '150ms', label: 'Fast' },
  { ms: '200ms', label: 'Default' },
  { ms: '300ms', label: 'Smooth' },
];

const PRIMARY_COLORS = [
  { name: 'Ink', var: '--color-ink', hex: '#44443d' },
  { name: 'Ink Light', var: '--color-ink-light', hex: '#8b867e' },
  { name: 'Ink Lighter', var: '--color-ink-lighter', hex: '#c5c1ba' },
  { name: 'Dot Grid', var: '--color-dot', hex: '#d8d3cb' },
  { name: 'Border', var: '--color-border', hex: '#e5e1d8' },
  { name: 'Sidebar Cream', var: '--color-sidebar-bg', hex: '#ebe6de' },
  { name: 'Cream Paper', var: '--color-cream', hex: '#f5f0e8' },
];

const SECONDARY_COLORS = [
  { name: 'Warm Brick Red', var: '--color-accent', hex: '#c9483b' },
  { name: 'Felt-Tip Red', var: '--color-accent-light', hex: '#e76052' },
  { name: 'Orange', var: '--color-priority-2', hex: '#e39133' },
  { name: 'Soft Moss', var: '--color-moss', hex: '#8ca46a' },
  { name: 'Annotation Blue', var: '--color-priority-3', hex: '#4d8fd6' },
];

export function StyleguidePage() {
  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
  });
  const weekStart = preferences?.weekStart ?? 'sunday';

  const [radioChoice, setRadioChoice] = useState('a');
  const [buttonGroupView, setButtonGroupView] = useState<'list' | 'kanban'>('list');
  const [buttonGroupVisibility, setButtonGroupVisibility] = useState<('completed' | 'notes')[]>(['completed']);
  const [buttonGroupIconOnly, setButtonGroupIconOnly] = useState<'timeline' | 'calendar' | 'board'>('timeline');
  const [toggleOn, setToggleOn] = useState(true);
  const [checkOn, setCheckOn] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });

  // CustomSelect state
  const [customSelectValue, setCustomSelectValue] = useState('2');

  // ContextMenu state
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  const contextMenuItems: ContextMenuItem[] = useMemo(() => [
    { type: 'item', label: 'Date', disabled: true, icon: <CalendarIcon size={14} /> },
    { type: 'item', label: 'Priority', disabled: true, icon: <Tag size={14} /> },
    {
      type: 'item',
      label: 'Collection',
      icon: <Briefcase size={14} />,
      submenu: [
        { type: 'item', label: 'No collection', onClick: () => console.log('No collection') },
        { type: 'separator' },
        ...COLLECTIONS.map(p => ({
          type: 'item' as const,
          label: p.name,
          icon: <span className="w-1.75 h-1.75 rounded-full" style={{ backgroundColor: p.color }} />,
          onClick: () => console.log(`Selected ${p.name}`)
        }))
      ]
    },
    { type: 'separator' },
    { type: 'item', label: 'Add above', icon: <ArrowUp size={14} /> },
    { type: 'item', label: 'Add below', icon: <ArrowDown size={14} /> },
    { type: 'separator' },
    { type: 'item', label: 'Delete', destructive: true, icon: <Trash2 size={14} /> }
  ], []);

  return (
    <div className="max-w-5xl pb-24 text-ink">
      <header className="page-header-copy sticky-page-header max-w-162">
        <div className="page-header-copy-text">
          <h1 className="m-0 h-6 p-0 text-lg leading-6 font-semibold text-ink">Styleguide</h1>
          <p className="page-header-subtitle m-0 h-6 p-0 text-[13px] leading-6 text-ink-light opacity-70">
            Fonts, colors, components, and tokens to build Planner ecosystem.
          </p>
        </div>
      </header>

      <div className="h-12" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Color Palette */}
        <Card title="Color Palette" span>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="lg:col-span-2">
              <h3 className="text-[10px] text-ink-light uppercase tracking-widest font-semibold">Primary Palette</h3>
              <p className="text-[11px] text-ink-light opacity-70 -mt-2 mb-4">Base neutral and structural colors - calm, readable foundations for content.</p>
              <div className="grid grid-cols-1 gap-4">
                {PRIMARY_COLORS.map(({ name, var: varName, hex }) => (
                  <div key={varName} className="flex items-start gap-3">
                    <span
                      className="w-12 h-12 rounded-sm border border-border shrink-0"
                      style={{ backgroundColor: hex }}
                      title={varName}
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-ink font-medium leading-none mb-1">{name}</span>
                      <span className="text-[10px] text-ink-light font-mono leading-none mb-1">{varName}</span>
                      <span className="text-[10px] text-ink-light font-mono leading-none">{hex}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-[10px] text-ink-light uppercase tracking-widest font-semibold -mb-2">Secondary Palette</h3>
              <p className="text-[11px] text-ink-light opacity-70 -mt-2 mb-4">Accent and semantic colors - for emphasis, priority, and status signals.</p>
              <div className="grid grid-cols-1 gap-4">
                {SECONDARY_COLORS.map(({ name, var: varName, hex }) => (
                  <div key={varName} className="flex items-start gap-3">
                    <span
                      className="w-12 h-12 rounded-sm border border-border shrink-0"
                      style={{ backgroundColor: hex }}
                      title={varName}
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-ink font-medium leading-none mb-1">{name}</span>
                      <span className="text-[10px] text-ink-light font-mono leading-none mb-1">{varName}</span>
                      <span className="text-[10px] text-ink-light font-mono leading-none">{hex}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Interface Typography */}
        <Card title="Typography" span>
          <div className="divide-y divide-border">
            {TYPE_SCALE.map(({ label, spec, className }) => (
              <div key={label} className="py-3 grid grid-cols-[180px_1fr] gap-6 items-center">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-ink uppercase tracking-widest">{label}</span>
                  <span className="text-[10px] text-ink-light font-mono mt-0.5 whitespace-nowrap">{spec}</span>
                </div>
                <span className={`text-ink overflow-hidden ${className}`}>Aa</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Buttons */}
        <Card title="Buttons" span>
          <div className="flex flex-col gap-6">
            {([
              { label: 'Primary', variant: 'primary' as const },
              { label: 'Secondary', variant: 'secondary' as const },
              { label: 'Tertiary', variant: 'tertiary' as const },
              { label: 'Destructive', variant: 'destructive' as const },
            ]).map(({ label, variant }) => (
              <div key={label} className="flex flex-col gap-2">
                <span className="text-[10px] text-ink-light uppercase tracking-widest font-semibold block">{label}</span>
                <div className="flex flex-wrap items-start gap-3">
                  <Button
                    variant={variant}
                    size="lg"
                    leftIcon={variant === 'destructive' ? <Trash2 /> : <Plus />}
                  >
                    {variant === 'destructive' ? 'Delete' : 'Large'}
                  </Button>
                  <Button
                    variant={variant}
                    size="md"
                    leftIcon={variant === 'destructive' ? <Trash2 /> : <Calendar />}
                  >
                    {variant === 'destructive' ? 'Delete' : 'Medium'}
                  </Button>
                  <Button variant={variant} size="sm">
                    {variant === 'destructive' ? 'Delete' : 'Small'}
                  </Button>
                  <Button variant={variant} size="xs">
                    {variant === 'destructive' ? 'Delete' : 'Tiny'}
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-ink-light uppercase tracking-widest font-semibold block">Disabled</span>
              <div className="flex flex-wrap items-start gap-3">
                <Button variant="secondary" size="lg" leftIcon={<Plus />} disabled>
                  Large
                </Button>
                <Button variant="secondary" size="md" leftIcon={<Calendar />} disabled>
                  Medium
                </Button>
                <Button variant="secondary" size="sm" disabled>
                  Small
                </Button>
                <Button variant="secondary" size="xs" disabled>
                  Tiny
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Button Group" span>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-ink-light uppercase tracking-widest font-semibold block">
                Single-select (list / kanban)
              </span>
              <ButtonGroup<'list' | 'kanban'>
                mode="single"
                value={buttonGroupView}
                onChange={setButtonGroupView}
                items={[
                  { value: 'list', label: 'List view', showLabel: true, icon: <ListTodo size={12} strokeWidth={1.5} /> },
                  { value: 'kanban', label: 'Kanban view', showLabel: true, icon: <Kanban size={12} strokeWidth={1.5} /> },
                ]}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-ink-light uppercase tracking-widest font-semibold block">
                Multi-select, label-only (Today / Upcoming)
              </span>
              <ButtonGroup<'today' | 'upcoming'>
                mode="single"
                value="today"
                onChange={() => {}}
                items={[
                  { value: 'today', label: 'Today' },
                  { value: 'upcoming', label: 'Upcoming' },
                ]}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-ink-light uppercase tracking-widest font-semibold block">
                Multi-select, independent toggles (completed / notes)
              </span>
              <ButtonGroup<'completed' | 'notes'>
                mode="multi"
                value={buttonGroupVisibility}
                onChange={(clicked) =>
                  setButtonGroupVisibility((prev) =>
                    prev.includes(clicked) ? prev.filter((v) => v !== clicked) : [...prev, clicked],
                  )
                }
                items={[
                  { value: 'completed', label: 'Hide completed', icon: <EyeOff size={12} strokeWidth={1.8} /> },
                  { value: 'notes', label: 'Hide old notes', icon: <FileClock size={12} strokeWidth={1.8} /> },
                ]}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-ink-light uppercase tracking-widest font-semibold block">
                Icon-only, three segments
              </span>
              <ButtonGroup<'timeline' | 'calendar' | 'board'>
                mode="single"
                value={buttonGroupIconOnly}
                onChange={setButtonGroupIconOnly}
                items={[
                  { value: 'timeline', label: 'Timeline view', icon: <Repeat2 size={12} strokeWidth={1.8} /> },
                  { value: 'calendar', label: 'Calendar view', icon: <Calendar size={12} strokeWidth={1.8} /> },
                  { value: 'board', label: 'Board view', icon: <Kanban size={12} strokeWidth={1.8} />, disabled: true },
                ]}
              />
            </div>
          </div>
        </Card>

        {/* Fields & Controls */}
        <Card title="Forms">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-4">
              <Field label="Text">
                <Input placeholder="Type something..." />
              </Field>
              <Field label="Search">
                <Input icon={<Search />} type="search" placeholder="Search tasks..." />
              </Field>
              <Field label="Select">
                <div className="flex flex-col gap-3">
                  <CustomSelect
                    options={[
                      { value: '1', label: 'Another option' },
                      { value: '2', label: 'Available option' },
                      { value: '3', label: 'Disabled option', disabled: true },
                    ]}
                    value={customSelectValue}
                    onChange={setCustomSelectValue}
                  />
                  <CustomSelect
                    options={[{ value: '1', label: 'Disabled' }]}
                    disabled
                  />
                  <CustomSelect
                    options={[{ value: '1', label: 'Invalid choice' }]}
                    value="1"
                    error
                  />
                  <div className="pb-45">
                    <CustomSelect
                      placeholder="Select an option..."
                      options={[
                        { value: '1', label: 'Option 1' },
                        { value: '2', label: 'Option 2' },
                        { value: '3', label: 'Option 3' },
                        { value: '4', label: 'Option 4' },
                      ]}
                      alwaysOpen
                    />
                  </div>
                </div>
              </Field>
              <Field label="Error state">
                <Input error defaultValue="Invalid value" errorText="Check the information." />
              </Field>
              <Field label="Help text">
                <Input placeholder="Add a note..." helpText="Tip: use @ for mentions and # for collections." />
              </Field>
            </div>
            <div className="flex flex-col gap-4">
              <Field label="Checkbox">
                <div className="flex flex-col gap-2">
                  <Checkbox checked readOnly label="Checked" />
                  <Checkbox checked={checkOn} onChange={(e) => setCheckOn(e.target.checked)} label="Unchecked" />
                </div>
              </Field>
              <Field label="Radio">
                <div className="flex flex-col gap-2">
                  <Radio name="sg-radio" checked={radioChoice === 'a'} onChange={() => setRadioChoice('a')} label="Selected option" />
                  <Radio name="sg-radio" checked={radioChoice === 'b'} onChange={() => setRadioChoice('b')} label="Another option" />
                </div>
              </Field>
              <Field label="Toggle">
                <div className="flex items-center gap-6">
                  <Toggle checked={toggleOn} onChange={setToggleOn} label="On / off" />
                  <Toggle checked={false} disabled label="Disabled" />
                </div>
              </Field>
            </div>
          </div>
        </Card>

        {/* Chips & Tags */}
        <Card title="Chips & Tags">
          <div className="flex flex-col gap-4">
            <div>
              <span className="text-[10px] text-ink-light uppercase tracking-widest block mb-2">Tag chips</span>
              <div className="flex flex-wrap gap-2 items-center">
                <Chip># ai</Chip>
                <Chip># tech</Chip>
                <Chip># dev</Chip>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-ink-light uppercase tracking-widest block mb-2">Collection chips</span>
              <div className="flex flex-wrap gap-2 items-center">
                {COLLECTIONS.map((p) => (
                  <CollectionChip key={p.name} name={p.name} color={p.color} />
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-ink-light uppercase tracking-widest block mb-2">Status</span>
              <div className="flex flex-wrap gap-2 items-center">
                <StatusPill status="open" />
                <StatusPill status="in_progress" />
                <StatusPill status="done" />
                <StatusPill status="blocked" />
              </div>
            </div>
            <div>
              <span className="text-[10px] text-ink-light uppercase tracking-widest block mb-2">Priorities</span>
              <div className="flex flex-wrap gap-4 items-center">
                <PriorityDot priority={1} showLabel />
                <PriorityDot priority={2} showLabel />
                <PriorityDot priority={3} showLabel />
                <PriorityDot priority={4} showLabel />
                <PriorityDot showLabel />
              </div>
            </div>
          </div>
        </Card>

        {/* Navigation */}
        <Card title="Navigation">
          <div className="w-55 border border-dot bg-(--planner-sidebar-bg) px-3 py-6">
            <div className="mb-6 ml-3">
              <div className="flex items-start gap-3">
                <PlannerIcon width={28} height={38} className="mt-1" />
                <div>
                  <div className="h-6 text-lg font-semibold leading-6 text-ink">Planner</div>
                  <div className="h-6 text-[13px] leading-6 text-ink-light opacity-60">Bulletjournal online</div>
                </div>
              </div>
            </div>
            <nav className="flex flex-col">
              {NAV.map(({ label, Icon, active }) => (
                <SidebarNavItem
                  key={label}
                  label={label}
                  icon={<Icon size={15} strokeWidth={1.5} />}
                  active={active}
                />
              ))}
            </nav>
            <div className="mt-6">
              <div className="flex items-center justify-between px-3">
                <span className="text-[10px] font-medium uppercase leading-6 tracking-widest text-ink-light">Collections</span>
                <span className="flex items-center text-sm leading-none text-ink-light" aria-hidden="true">+</span>
              </div>
              {NAV_COLLECTIONS.map((collection) => (
                <div
                  key={collection.name}
                  className={`collection-row flex h-6 items-center gap-1.75 pr-2 text-[13px] text-ink ${collection.depth === 0 ? 'pl-3' : 'pl-5.5'}`}
                >
                  <span className="flex w-4 shrink-0 items-center justify-center">
                    <span
                      className="block w-1.75 h-1.75 rounded-full filter-[saturate(0.55)]"
                      style={{ background: collection.color }}
                    />
                  </span>
                  <span className="truncate text-[13px] text-ink opacity-60">{collection.name}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Toolbar / View Options */}
        <Card title="Toolbar / View Options" span>
          <ViewToolbar />
        </Card>

        {/* Task Rows */}
        <Card title="Task Rows" span>
          <div className="flex flex-col gap-1">
            <TaskRowSpecimen priority={1} title="Review quarterly editorial plan" tags={['editorial', 'planner']} date="Jul 10" flagged />
            <TaskRowSpecimen priority={2} title="Draft weekly entry in Lora serif" tags={['writing']} date="Jul 12" />
            <TaskRowSpecimen priority={3} title="Implement interactive habit grid" tags={['dev']} date="Jun 17" selected />
            <TaskRowSpecimen priority={4} title="Configure cross-out styles for tests" tags={['dev']} date="Jun 09" completed />
          </div>
        </Card>

        {/* Board Card */}
        <Card title="Board Card">
          <div className="w-72">
            <BoardCard
              task={{
                id: 'board-card-specimen',
                title: 'Review the board interaction notes',
                description: 'Keep the paper texture visible through every surface.',
                priority: 2,
                collectionId: 'styleguide',
                dueDate: '2026-08-14',
                isCompleted: false,
                orderValue: 1000,
                depth: 0,
                type: 'task',
                labels: [
                  { id: 'label-design', name: 'design', color: '#c98079' },
                  { id: 'label-review', name: 'review', color: '#8ca46a' },
                ],
              }}
              subtasks={[
                {
                  id: 'board-card-subtask-1',
                  title: 'Check spacing',
                  priority: 4,
                  collectionId: 'styleguide',
                  parentTaskId: 'board-card-specimen',
                  isCompleted: true,
                  orderValue: 1000,
                  depth: 0,
                  type: 'task',
                },
                {
                  id: 'board-card-subtask-2',
                  title: 'Verify contrast',
                  priority: 4,
                  collectionId: 'styleguide',
                  parentTaskId: 'board-card-specimen',
                  isCompleted: false,
                  orderValue: 2000,
                  depth: 0,
                  type: 'task',
                },
              ]}
            />
          </div>
        </Card>

        {/* Calendar & Monthly */}
        <Card title="Calendar & Monthly">
          <MonthlyCalendarSpecimen compact weekStart={weekStart} />
        </Card>

        {/* Month Selector */}
        <Card title="Month Selector" span>
          <MonthSelector
            year={selectedMonth.year}
            month={selectedMonth.month}
            onChange={(year, month) => setSelectedMonth({ year, month })}
          />
        </Card>

        {/* Habit */}
        <Card title="Habit" span>
          <HabitSpecimen weekStart={weekStart} />
        </Card>
        {/* Calendar */}
        <Card title="Calendar">
          <DatePickerSpecimen weekStart={weekStart} />
        </Card>

        {/* Essential Tokens */}
        <Card title="Essential Tokens" span>
          <div className="flex flex-col gap-5">
            <TokenRow label="Spacing">
              <div className="flex flex-col gap-3">
                {SPACING.map((s) => (
                  <div key={s} className="flex items-center gap-4">
                    <div className="flex items-center" style={{ gap: `${s}px` }}>
                      <span className="block w-1.75 h-1.75 rounded-[2px] bg-dot" aria-hidden="true" />
                      <span className="block w-1.75 h-1.75 rounded-[2px] bg-dot" aria-hidden="true" />
                    </div>
                    <span className="text-[9px] text-ink-light font-mono leading-none">{s}px</span>
                  </div>
                ))}
              </div>
            </TokenRow>

            <TokenRow label="Radius">
              <div className="flex items-end gap-2">
                {RADII.map((r) => (
                  <div key={r} className="flex flex-col items-center gap-1">
                    <span className="w-7 h-7 border border-border bg-dot/40" style={{ borderRadius: r }} />
                    <span className="text-[9px] text-ink-light font-mono">{r}</span>
                  </div>
                ))}
              </div>
            </TokenRow>

            <TokenRow label="Borders">
              <div className="flex flex-col gap-2">
                <span className="w-full border-t border-border" />
                <span className="text-[10px] text-ink-light font-mono">1px · #E5E1D8</span>
              </div>
            </TokenRow>

            <TokenRow label="Shadows">
              <div className="flex gap-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="w-10 h-10 rounded-sm bg-cream border border-border shadow-subtle" />
                  <span className="text-[9px] text-ink-light">Subtle</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="w-10 h-10 rounded-sm bg-cream border border-border shadow-medium" />
                  <span className="text-[9px] text-ink-light">Medium</span>
                </div>
              </div>
            </TokenRow>

            <TokenRow label="Motion">
              <div className="flex flex-wrap gap-6">
                {MOTION.map(({ ms, label }) => (
                  <div key={ms} className="flex items-center gap-2">
                    <span className="text-sm text-ink">{ms}</span>
                    <span className="text-xs text-ink-light">{label}</span>
                  </div>
                ))}
              </div>
            </TokenRow>
          </div>
        </Card>



        {/* Context Menu */}
        <Card title="Context Menu">
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-ink-light leading-5">
              Right-click the area below to test the context menu, or view the static specimens.
            </p>
            <div
              className="h-32 border-2 border-dashed border-border rounded-md flex items-center justify-center bg-[#d4cfc7]/20 text-ink-light text-sm select-none"
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenuPos({ x: e.clientX, y: e.clientY });
              }}
            >
              Right-click me
            </div>
            {contextMenuPos && (
              <ContextMenu
                items={contextMenuItems}
                position={contextMenuPos}
                onClose={() => setContextMenuPos(null)}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-ink-light uppercase tracking-widest block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function TokenRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2">
      <span className="text-[10px] text-ink-light uppercase tracking-widest block">{label}</span>
      {children}
    </div>
  );
}
