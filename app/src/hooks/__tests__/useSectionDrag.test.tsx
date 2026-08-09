import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSectionDrag } from '../useSectionDrag';
import { apiUpdateSection } from '../../api/client';
import type { Section } from '../../stores/taskStore';
import type { DragEndEvent } from '@dnd-kit/core';
import type { SectionHeaderDragData } from '../../types/drag';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  apiUpdateSection: vi.fn(),
}));

const updateSection = vi.mocked(apiUpdateSection);

let registered: ((e: DragEndEvent) => void) | null = null;

vi.mock('../../contexts/usePlannerDrag', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/usePlannerDrag')>();
  return {
    ...actual,
    usePlannerDragHandlers: (_kind: string, handlers: { onDragEnd?: (e: DragEndEvent) => void }) => {
      registered = handlers.onDragEnd ?? registered;
    },
  };
});

const COLLECTION = 'collection-1';

const section = (id: string, orderValue: number): Section => ({
  id,
  name: id,
  collectionId: COLLECTION,
  orderValue,
});

const sections: Section[] = [section('a', 0), section('b', 1000), section('c', 2000)];

function headerDrag(sectionId: string): SectionHeaderDragData {
  return { kind: 'section-header', sectionId, collectionId: COLLECTION };
}

function mount(initial: Section[], onError?: () => void) {
  const emitted: Section[][] = [];
  function Harness() {
    useSectionDrag({
      sections: initial,
      setSections: (updater) => emitted.push(updater(initial)),
      onError,
    });
    return null;
  }
  render(<Harness />);
  return emitted;
}

async function drop(active: SectionHeaderDragData, over: SectionHeaderDragData | null) {
  await act(async () => {
    registered?.({
      active: { id: active.sectionId, data: { current: active } },
      over: over ? { id: over.sectionId, data: { current: over } } : null,
    } as unknown as DragEndEvent);
  });
}

beforeEach(() => {
  registered = null;
  updateSection.mockReset();
  updateSection.mockResolvedValue({ id: 'a', name: 'a', collectionId: COLLECTION, orderValue: 0 });
});

describe('useSectionDrag: reordering sections', () => {
  it('sends the target index among the other sections', async () => {
    mount(sections);
    await drop(headerDrag('a'), headerDrag('c'));

    expect(updateSection).toHaveBeenCalledWith('a', { position: 2 });
  });

  it('applies the reorder optimistically before the request resolves', async () => {
    const emitted = mount(sections);
    await drop(headerDrag('a'), headerDrag('c'));

    expect(emitted[0].map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('moving a section upward lands it just before the target', async () => {
    mount(sections);
    await drop(headerDrag('c'), headerDrag('a'));

    expect(updateSection).toHaveBeenCalledWith('c', { position: 0 });
  });

  it('does nothing when released on itself', async () => {
    mount(sections);
    await drop(headerDrag('a'), headerDrag('a'));

    expect(updateSection).not.toHaveBeenCalled();
  });

  it('does nothing when released outside any section', async () => {
    mount(sections);
    await drop(headerDrag('a'), null);

    expect(updateSection).not.toHaveBeenCalled();
  });

  it('reverts the optimistic order and reports the error on failure', async () => {
    updateSection.mockRejectedValue(new Error('network'));
    const onError = vi.fn();
    const emitted = mount(sections, onError);

    await drop(headerDrag('a'), headerDrag('c'));

    expect(emitted[emitted.length - 1]).toEqual(sections);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
