import { describe, it, expect } from 'vitest';
import { describeAgentChange } from '../agentNotice';
import { translate } from '../../i18n/I18nContext';
import type { SyncEvent } from '../../hooks/useSync';
import type { TranslationKey } from '../../i18n/catalogs';

const t = (key: TranslationKey, values?: Record<string, string | number>) => translate('en', key, values);

function event(overrides: Partial<SyncEvent>): SyncEvent {
  return {
    id: 'e1',
    entityType: 'task',
    eventType: 'created',
    entityId: 't1',
    userId: 'u1',
    emittedAt: '2026-10-06T00:00:00Z',
    actor: { type: 'token', label: 'Claude Desktop' },
    payload: { title: 'Buy milk' },
    ...overrides,
  };
}

describe('describeAgentChange', () => {
  it('ignores changes not made by an agent and non-task entities', () => {
    expect(describeAgentChange(event({ actor: undefined }), t)).toBeNull();
    expect(describeAgentChange(event({ entityType: 'label' }), t)).toBeNull();
  });

  it('names the agent and the task', () => {
    expect(describeAgentChange(event({}), t)).toBe('Claude Desktop added "Buy milk"');
    expect(describeAgentChange(event({ eventType: 'updated' }), t)).toBe('Claude Desktop updated "Buy milk"');
    expect(describeAgentChange(event({ eventType: 'completed' }), t)).toBe('Claude Desktop completed "Buy milk"');
  });

  it('falls back when there is no title to show', () => {
    expect(describeAgentChange(event({ eventType: 'deleted', payload: undefined }), t)).toBe('Claude Desktop deleted a task');
    expect(describeAgentChange(event({ payload: {} }), t)).toBe('Claude Desktop changed your tasks');
  });
});
