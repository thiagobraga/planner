import type { TranslationKey } from '../i18n/catalogs';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export interface ParsedColor {
  rgb: Rgb;
  alpha: number;
}

export type ColorFormat = 'hex' | 'rgb' | 'hsl';

export type WeekStart = 'sunday' | 'monday';

export interface WeekDay {
  iso: string;
  dayOfMonth: number;
  /** Native Date.getDay() (0 = Sunday), for weekend shading independent of weekStart. */
  weekday: number;
  future: boolean;
}

export interface MonthDay {
  iso: string;
  dayOfMonth: number;
  /** Zero-based column in the configured weekday order. */
  dow: number;
  future: boolean;
}

export interface ParsedDate {
  text: string;
  preview: string;
  isoDate: string;
  recurrenceRule?: object | null;
}

export type FontOption = 'lora' | 'playpen' | 'hubballi';

export type PhraseSection = 'daily' | 'inbox' | 'habits' | 'upcoming' | 'monthly';

export type QueuedMutationMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface QueuedMutation {
  id: string;
  method: QueuedMutationMethod;
  path: string;
  body: string;
  createdAt: number;
  ownerUserId: string;
  /**
   * For a create-type mutation (POST with no id segment in its path), the
   * client-minted id synthesized as the optimistic response's `id` (see
   * `client.ts`'s `buildSyntheticResponse`). Once this mutation replays
   * successfully and the real server id is known, `remapQueuedId` uses this
   * to rewrite any not-yet-replayed queued mutation that referenced it.
   */
  clientEntityId?: string;
}

/** An `updated` payload for a structural move carries the ids it disturbed. */
export interface MovePayload {
  affectedIds?: string[];
}

export interface EchoableEvent {
  entityId: string;
  payload?: unknown;
}

export interface Ordered {
  orderValue: number;
}

export type DayColumnId = 'migrate' | `day:${string}`;

export interface DayColumn {
  id: DayColumnId;
  /** ISO YYYY-MM-DD for a day column, null for Migrate. */
  iso: string | null;
  /** Native Date.getDay() (0 = Sunday), only set for day columns. */
  weekday: number | null;
  droppable: boolean;
}

export type DateQuickOptionKey = 'today' | 'tomorrow' | 'weekend' | 'nextWeek';

export interface DateQuickOption {
  key: DateQuickOptionKey;
  date: string;
}

export type AgentTranslate = (
  key: TranslationKey,
  values?: Record<string, string | number>,
) => string;

export type RecurrenceLocale = 'en' | 'pt-BR';
