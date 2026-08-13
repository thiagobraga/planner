import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContextMenu } from '../ui/ContextMenu';
import { Calendar, Tag, Folder, Trash2 } from 'lucide-react';

describe('ContextMenu with icons', () => {
  it('renders menu items with provided Lucide icons', () => {
    const items = [
      { type: 'item' as const, label: 'Date', icon: <Calendar data-testid="icon-calendar" size={14} /> },
      { type: 'item' as const, label: 'Priority', icon: <Tag data-testid="icon-tag" size={14} /> },
      { type: 'item' as const, label: 'Project', icon: <Folder data-testid="icon-folder" size={14} /> },
      { type: 'item' as const, label: 'Delete', icon: <Trash2 data-testid="icon-trash" size={14} />, destructive: true },
    ];

    render(<ContextMenu items={items} position={{ x: 100, y: 100 }} onClose={vi.fn()} />);

    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();

    expect(screen.getByTestId('icon-calendar')).toBeInTheDocument();
    expect(screen.getByTestId('icon-tag')).toBeInTheDocument();
    expect(screen.getByTestId('icon-folder')).toBeInTheDocument();
    expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
  });
});
