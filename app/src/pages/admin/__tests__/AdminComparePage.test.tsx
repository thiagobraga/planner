import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../../../i18n/I18nContext';
import { AdminComparePage } from '../AdminComparePage';

afterEach(() => window.localStorage.removeItem('planner_locale'));

describe('AdminComparePage', () => {
  it('renders feature rows with one status cell per app', () => {
    window.localStorage.setItem('planner_locale', 'en');
    render(<I18nProvider><AdminComparePage /></I18nProvider>);

    const table = screen.getByRole('table');
    expect(within(table).getByText('Core Task Management')).toBeInTheDocument();
    const taskRow = within(table).getByText('Tasks').closest('tr')!;
    const cells = within(taskRow).getAllByRole('cell');
    expect(cells).toHaveLength(8);
    expect(cells.slice(1).every((cell) => cell.textContent === '✓')).toBe(true);
    expect(within(table).getByText('MCP (Model Context Protocol)')).toBeInTheDocument();
  });

  it('renders Portuguese feature, category and legend labels', () => {
    window.localStorage.setItem('planner_locale', 'pt-BR');
    render(<I18nProvider><AdminComparePage /></I18nProvider>);

    expect(screen.getByRole('table')).toHaveTextContent('Gerenciamento Básico de Tarefas');
    expect(screen.getByRole('table')).toHaveTextContent('Tarefas');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Comparação de Recursos');
    expect(screen.getByText('Parcial')).toBeInTheDocument();
    expect(screen.queryByText(/^compare\./)).not.toBeInTheDocument();
  });
});
