export interface ParserOptions {
  now?: Date;
  /** 'pt-BR' reads slashed dates day-first (17/10); anything else month-first. */
  locale?: string;
}

export type PeggyParser = { parse: (input: string, options?: Record<string, unknown>) => unknown };
