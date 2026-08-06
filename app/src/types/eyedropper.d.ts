// The EyeDropper API ships in Chromium but is absent from TypeScript's DOM lib.
// The picker feature-detects it before use; this only makes the call typed.
interface EyeDropperOpenOptions {
  signal?: AbortSignal;
}

interface EyeDropperResult {
  sRGBHex: string;
}

declare class EyeDropper {
  constructor();
  open(options?: EyeDropperOpenOptions): Promise<EyeDropperResult>;
}

interface Window {
  EyeDropper?: typeof EyeDropper;
}
