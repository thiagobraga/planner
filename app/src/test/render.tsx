import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import type { ApiTask } from '../types/api';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  element: ReactNode,
  client = createTestQueryClient(),
  initialEntries = ['/'],
) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

export const sampleTasks: ApiTask[] = [
  {
    id: 'task-1',
    title: 'Buy groceries',
    description: '',
    priority: 4,
    collectionId: 'col-1',
    sectionId: undefined,
    parentTaskId: undefined,
    dueDate: undefined,
    isCompleted: false,
    orderValue: 1,
    depth: 0,
    type: 'task',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'task-2',
    title: 'Write tests',
    description: '',
    priority: 4,
    collectionId: 'col-1',
    sectionId: undefined,
    parentTaskId: undefined,
    dueDate: undefined,
    isCompleted: true,
    orderValue: 2,
    depth: 0,
    type: 'task',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

export function createdTask(overrides: Partial<ApiTask> = {}): ApiTask {
  return {
    id: 'created-1',
    title: 'Created',
    description: '',
    priority: 4,
    collectionId: 'col-1',
    sectionId: undefined,
    parentTaskId: undefined,
    dueDate: undefined,
    isCompleted: false,
    orderValue: 0,
    depth: 0,
    type: 'task',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}
