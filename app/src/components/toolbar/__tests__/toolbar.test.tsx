import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Folder } from 'lucide-react';
import { ViewMenu } from '../ViewMenu';
import { GroupByMenu } from '../GroupByMenu';
import { DateNav } from '../DateNav';
import { PageToolbar, densityForWidth } from '../PageToolbar';
import type { ViewMenuProps } from '../../../types/toolbar';

function renderViewMenu(props: Partial<ViewMenuProps> = {}) {
  const handlers = { onLayoutChange: vi.fn(), onStyleChange: vi.fn(), onRangeChange: vi.fn() };
  render(
    <ViewMenu layouts={['list', 'columns']} layout="list" style="notebook" range="today" {...handlers} {...props} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'View' }));
  return { ...handlers, menu: screen.getByRole('menu') };
}

describe('ViewMenu', () => {
  it('lists the available layouts with their shortcuts and marks the current one', () => {
    const { menu } = renderViewMenu();
    const layout = within(menu).getByRole('group', { name: 'Layout' });
    const items = within(layout).getAllByRole('menuitemradio');
    expect(items.map((item) => item.textContent)).toEqual(['Listv l', 'Columnsv k']);
    expect(items[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('switches layout and style without closing', () => {
    const { menu, onLayoutChange, onStyleChange } = renderViewMenu();
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Columns/ }));
    fireEvent.click(within(menu).getByRole('radio', { name: 'Cards' }));
    expect(onLayoutChange).toHaveBeenCalledWith('columns');
    expect(onStyleChange).toHaveBeenCalledWith('cards');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('offers named presets on List', () => {
    const { menu, onRangeChange } = renderViewMenu();
    const range = within(menu).getByRole('group', { name: 'Range' });
    expect(within(range).getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
      'Todayv 1', 'Tomorrow', 'This weekv w', 'Next 7 days', 'Upcoming', 'Monthv m',
    ]);
    fireEvent.click(within(range).getByRole('menuitemradio', { name: /Upcoming/ }));
    expect(onRangeChange).toHaveBeenCalledWith('upcoming');
  });

  it('offers day and week pills on Columns, with Month disabled', () => {
    const { menu, onRangeChange } = renderViewMenu({ layout: 'columns', range: 'd3' });
    expect(within(menu).getByRole('button', { name: '3 days' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(menu).getByRole('button', { name: 'Month' })).toBeDisabled();
    fireEvent.click(within(menu).getByRole('button', { name: '2 weeks' }));
    expect(onRangeChange).toHaveBeenCalledWith('w2');
  });

  it('hides the range on pages without dates', () => {
    const { menu } = renderViewMenu({ range: undefined, onRangeChange: undefined });
    expect(within(menu).queryByRole('group', { name: 'Range' })).toBeNull();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    renderViewMenu();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'View' })).toHaveFocus();
  });

  it('moves focus with the arrow keys', () => {
    const { menu } = renderViewMenu();
    expect(within(menu).getByRole('menuitemradio', { name: /List/ })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(within(menu).getByRole('menuitemradio', { name: /Columns/ })).toHaveFocus();
  });
});

describe('GroupByMenu', () => {
  it('shows the current grouping and picks another', () => {
    const onChange = vi.fn();
    render(
      <GroupByMenu
        value="status"
        onChange={onChange}
        options={[
          { value: 'status', label: 'Status', icon: <Folder /> },
          { value: 'priority', label: 'Priority', icon: <Folder /> },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Group: Status' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Priority' }));
    expect(onChange).toHaveBeenCalledWith('priority');
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('toolbar triggers', () => {
  const dateNav = { from: '2026-11-13', to: '2026-11-15', today: '2026-11-14', weekStart: 'sunday' as const, onPrevious: vi.fn(), onNext: vi.fn(), onToday: vi.fn(), onPick: vi.fn() };

  it('render View and Group as the same small button as Today', () => {
    render(
      <>
        <DateNav {...dateNav} />
        <ViewMenu layouts={['list', 'columns']} layout="list" style="notebook" onLayoutChange={vi.fn()} onStyleChange={vi.fn()} />
        <GroupByMenu value="status" onChange={vi.fn()} options={[{ value: 'status', label: 'Status', icon: <Folder /> }]} />
      </>,
    );
    const todayClasses = screen.getByRole('button', { name: 'Today' }).className.split(/\s+/).filter(Boolean);
    for (const name of ['View', 'Group: Status']) {
      const trigger = screen.getByRole('button', { name });
      expect(trigger.className.split(/\s+/)).toEqual(expect.arrayContaining(todayClasses));
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveClass('is-open');
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    }
  });

  it('does not bold the range picker', () => {
    render(<DateNav {...dateNav} />);
    expect(screen.getByRole('button', { name: '11/13 to 11/15/2026' })).not.toHaveClass('font-semibold');
  });

  it('closes the range picker on a press outside, even one whose mousedown is cancelled', () => {
    render(<><div data-testid="row" onPointerDown={(event) => event.preventDefault()} /><DateNav {...dateNav} /></>);
    const trigger = screen.getByRole('button', { name: '11/13 to 11/15/2026' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.pointerDown(screen.getByTestId('row'), { button: 2 });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('leaves full width to the Planner menu', () => {
    render(<PageToolbar view={() => <span>view</span>} />);
    expect(screen.queryByRole('button', { name: 'Window' })).toBeNull();
  });
});

describe('DateNav', () => {
  const base = {
    from: '2026-11-13', to: '2026-11-15', today: '2026-11-14', weekStart: 'sunday' as const,
    onPrevious: vi.fn(), onNext: vi.fn(), onToday: vi.fn(), onPick: vi.fn(),
  };

  it('shows the range and moves both ways', () => {
    render(<DateNav {...base} />);
    expect(screen.getByRole('button', { name: '11/13 to 11/15/2026' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(base.onPrevious).toHaveBeenCalled();
    expect(base.onNext).toHaveBeenCalled();
    expect(base.onToday).toHaveBeenCalled();
  });

  it('moves Today into the picker when tight and highlights the range', () => {
    render(<DateNav {...base} compact hideToday />);
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '11/13-15' }));
    const picker = screen.getByRole('dialog');
    expect(picker.querySelectorAll('[data-in-range]')).toHaveLength(3);
    fireEvent.click(within(picker).getByRole('button', { name: 'Today' }));
    expect(base.onToday).toHaveBeenCalled();
  });
});

describe('densityForWidth', () => {
  it('gives up one thing per step as the row narrows', () => {
    expect(densityForWidth(720)).toBe(0);
    expect(densityForWidth(600)).toBe(1);
    expect(densityForWidth(500)).toBe(2);
    expect(densityForWidth(300)).toBe(2);
  });
});
