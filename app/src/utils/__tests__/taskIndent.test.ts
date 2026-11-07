import { describe, expect, it } from 'vitest';
import { resolveTaskIndent } from '../taskIndent';
import type { Task } from '../../components/TaskItem';

const row = (id: string, orderValue: number, extra: Partial<Task> = {}): Task => ({
  id, title: id, orderValue, priority: 4, isCompleted: false, type: 'task',
  collectionId: 'c1', sectionId: 's1', dueDate: '2026-11-06', ...extra,
});
const scope = { kind: 'section', sectionId: 's1' } as const;

describe('resolveTaskIndent', () => {
  it('rejects a lone task, the first task, and root unindent', () => {
    expect(resolveTaskIndent([row('a', 0)], 'a', 1, scope)).toBeNull();
    expect(resolveTaskIndent([row('a', 0), row('b', 1000)], 'a', 1, scope)).toBeNull();
    expect(resolveTaskIndent([row('a', 0)], 'a', -1, scope)).toBeNull();
  });

  it('indents under the previous rendered sibling and unindents after its parent', () => {
    const tasks = [row('a', 0), row('b', 1000)];
    const indent = resolveTaskIndent(tasks, 'b', 1, scope)!;
    expect(indent.input).toMatchObject({ parentTaskId: 'a', position: 0, scope });
    expect(indent.tasks.find((t) => t.id === 'b')).toMatchObject({ parentTaskId: 'a', indent: 1 });
    const unindent = resolveTaskIndent(indent.tasks, 'b', -1, scope)!;
    expect(unindent.input).toMatchObject({ parentTaskId: null, position: 1, scope });
  });

  it('does not cross section, day, or collection boundaries', () => {
    for (const extra of [{ sectionId: 's2' }, { dueDate: '2026-11-07' }, { collectionId: 'c2' }]) {
      expect(resolveTaskIndent([row('a', 0, extra), row('b', 1000)], 'b', 1, scope)).toBeNull();
    }
  });

  it('rejects a move that would put a descendant past depth five', () => {
    const tasks = [row('root', 0), row('one', 0, { parentTaskId: 'root' }), row('two', 0, { parentTaskId: 'one' }), row('three', 0, { parentTaskId: 'two' }), row('a', 0, { parentTaskId: 'three' }), row('b', 1000, { parentTaskId: 'three' }), row('child', 0, { parentTaskId: 'b' })];
    expect(resolveTaskIndent(tasks, 'b', 1, scope)).toBeNull();
  });

  it('does not indent the first child under a cousin from another parent', () => {
    const tasks = [row('a', 0), row('a-child', 0, { parentTaskId: 'a' }), row('b', 1000), row('b-child', 0, { parentTaskId: 'b' })];
    expect(resolveTaskIndent(tasks, 'b-child', 1, scope)).toBeNull();
  });

  it('keeps a Kanban column scope in the structural move request', () => {
    const tasks = [row('a', 0), row('b', 1000)];
    expect(resolveTaskIndent(tasks, 'b', 1, { kind: 'status', collectionId: 'c1', statusId: 'ready' })?.input)
      .toMatchObject({ statusId: 'ready', scope: { kind: 'status', statusId: 'ready' } });
    expect(resolveTaskIndent(tasks, 'b', 1, { kind: 'priority', collectionId: 'c1', priority: 4 })?.input)
      .toMatchObject({ priority: 4, scope: { kind: 'priority', priority: 4 } });
  });
});
