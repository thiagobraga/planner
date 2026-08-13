import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { InboxPage } from '../../InboxPage';
import { baseInboxData, basePreferences, createdTask, sampleTasks, section } from './inboxFixtures';

type AnyMock = MockInstance;

export interface InboxMockRefs {
  mockFetchInboxTasks: AnyMock;
  mockApiCreateTask: AnyMock;
  mockApiUpdateTask: AnyMock;
  mockApiToggleTask: AnyMock;
  mockApiDeleteTask: AnyMock;
  mockApiCreateSection: AnyMock;
  mockApiUpdateSection: AnyMock;
  mockApiDeleteSection: AnyMock;
  mockApiUpdatePreferences: AnyMock;
  mockFetchPreferences: AnyMock;
  mockFetchCollections: AnyMock;
  mockTaskList: AnyMock;
  mockUseSync: AnyMock;
  mockUseTaskDrag: AnyMock;
  mockUseSectionDrag: AnyMock;
}

export function applyInboxDefaults(refs: InboxMockRefs): void {
  refs.mockFetchInboxTasks.mockReset();
  refs.mockApiCreateTask.mockReset();
  refs.mockApiUpdateTask.mockReset();
  refs.mockApiToggleTask.mockReset();
  refs.mockApiDeleteTask.mockReset();
  refs.mockApiCreateSection.mockReset();
  refs.mockApiUpdateSection.mockReset();
  refs.mockApiDeleteSection.mockReset();
  refs.mockApiUpdatePreferences.mockReset();
  refs.mockFetchPreferences.mockReset();
  refs.mockFetchCollections.mockReset();
  refs.mockTaskList.mockClear();
  refs.mockUseSync.mockClear();
  refs.mockUseTaskDrag.mockClear();
  refs.mockUseSectionDrag.mockClear();
  refs.mockFetchInboxTasks.mockResolvedValue(baseInboxData);
  refs.mockFetchPreferences.mockResolvedValue(basePreferences);
  refs.mockFetchCollections.mockResolvedValue([]);
  refs.mockApiCreateTask.mockResolvedValue(createdTask());
  refs.mockApiUpdateTask.mockResolvedValue(undefined);
  refs.mockApiToggleTask.mockResolvedValue(sampleTasks[0]);
  refs.mockApiDeleteTask.mockResolvedValue(undefined);
  refs.mockApiCreateSection.mockResolvedValue(section());
  refs.mockApiUpdateSection.mockResolvedValue(section());
  refs.mockApiDeleteSection.mockResolvedValue(undefined);
  refs.mockApiUpdatePreferences.mockResolvedValue(basePreferences);
  refs.mockUseTaskDrag.mockReturnValue({ activeDragId: null });
  refs.mockUseSync.mockReturnValue(undefined);
  refs.mockUseSectionDrag.mockReturnValue(undefined);
}

export function inboxBeforeEach(refs: InboxMockRefs): void {
  beforeEach(() => applyInboxDefaults(refs));
  afterEach(() => {
    vi.restoreAllMocks();
  });
}

export function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export function inboxList() {
  return screen.getByTestId('task-list-collection:inbox');
}

export interface InboxHarnessDeps {
  mockTaskList: AnyMock;
  mockUseTaskDrag: AnyMock;
  mockUseSectionDrag: AnyMock;
}

export function createInboxHarness({ mockTaskList, mockUseTaskDrag, mockUseSectionDrag }: InboxHarnessDeps) {
  return {
    taskListCalls(containerId: string) {
      return mockTaskList.mock.calls.filter(([props]) => props.containerId === containerId);
    },
    latestDragOptions() {
      return mockUseTaskDrag.mock.calls.at(-1)![0];
    },
    latestSectionDragOptions() {
      return mockUseSectionDrag.mock.calls.at(-1)![0];
    },
  };
}