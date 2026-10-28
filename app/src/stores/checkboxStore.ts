import { create } from 'zustand';

/** Mirrors the showCheckboxes preference so task rows need no query provider. */
export const useCheckboxStore = create<{ enabled: boolean }>(() => ({ enabled: false }));
