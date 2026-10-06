import type { SyncEvent } from '../hooks/useSync';
import type { TranslationKey } from '../i18n/catalogs';

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

/** One line describing what an agent just did, or null for events that are not the agent's. */
export function describeAgentChange(event: SyncEvent, t: Translate): string | null {
  if (!event.actor || event.entityType !== 'task') return null;

  const agent = event.actor.label;
  const title = (event.payload as { title?: unknown } | undefined)?.title;
  if (event.eventType === 'deleted') return t('agentNotice.deleted', { agent });
  if (typeof title !== 'string') return t('agentNotice.generic', { agent });
  if (event.eventType === 'created') return t('agentNotice.created', { agent, title });
  if (event.eventType === 'completed') return t('agentNotice.completed', { agent, title });
  return t('agentNotice.updated', { agent, title });
}
