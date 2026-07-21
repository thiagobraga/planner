import { describe, it, expect } from 'vitest';
import { trackCreate, resolveCreatedId } from '../pendingCreates';

describe('pendingCreates', () => {
  it('passes through an id that is not a pending create', async () => {
    await expect(resolveCreatedId('real-1')).resolves.toBe('real-1');
  });

  it('passes through null', async () => {
    await expect(resolveCreatedId(null)).resolves.toBeNull();
  });

  it('waits for an in-flight create and answers with the real id', async () => {
    let settle: (entity: { id: string }) => void = () => {};
    trackCreate('temp-1', new Promise((resolve) => { settle = resolve; }));

    const pending = resolveCreatedId('temp-1');
    settle({ id: 'real-1' });

    await expect(pending).resolves.toBe('real-1');
  });

  it('answers null when the parent create failed, so the child still lands', async () => {
    trackCreate('temp-2', Promise.reject(new Error('nope')));
    await expect(resolveCreatedId('temp-2')).resolves.toBeNull();
  });

  it('forgets a create once it settles', async () => {
    trackCreate('temp-3', Promise.resolve({ id: 'real-3' }));
    await resolveCreatedId('temp-3');
    // Nothing in flight now, so the id stands for itself again.
    await expect(resolveCreatedId('temp-3')).resolves.toBe('temp-3');
  });
});
