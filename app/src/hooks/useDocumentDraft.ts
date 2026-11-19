import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiSaveTaskDocument, fetchTaskDocument } from '../api/client';
import { toServerContent } from '../utils/documentContent';
import type { DocumentNode, TaskDocumentDto } from '../contracts/document';
import type { DocumentDraftState } from '../types/detail';

export const AUTOSAVE_MS = 800;

// In memory only: an unsaved draft survives switching items or closing the
// panel within this tab, never a reload, and account content never reaches
// localStorage.
const draftMemory = new Map<string, { draft: DocumentNode; base: TaskDocumentDto }>();

export function documentQueryKey(taskId: string) {
  return ['document', taskId] as const;
}

function conflictCurrent(err: unknown): TaskDocumentDto | null {
  if (!(err instanceof ApiError) || err.code !== 'DOCUMENT_CONFLICT' || !Array.isArray(err.details)) return null;
  return (err.details[0] as { current?: TaskDocumentDto } | undefined)?.current ?? null;
}

/**
 * The editor's save loop: debounced compare-and-swap saves on the last known
 * revision. A remote change replaces the editor only while it holds no
 * unsaved edits; otherwise the next save meets the 409 and the user chooses.
 */
export function useDocumentDraft(taskId: string) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: documentQueryKey(taskId), queryFn: () => fetchTaskDocument(taskId) });
  const remembered = draftMemory.get(taskId);
  const [state, setState] = useState<DocumentDraftState>(() => remembered
    ? { status: 'dirty', base: remembered.base, draft: remembered.draft, conflict: null, error: null }
    : { status: 'saved', base: null, draft: null, conflict: null, error: null });
  // What the editor shows; `key` changes only when the editor must be replaced.
  const [view, setView] = useState<{ key: number; content: DocumentNode | null }>(() => ({ key: 0, content: remembered?.draft ?? null }));
  const stateRef = useRef(state);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);

  const update = useCallback((patch: Partial<DocumentDraftState>) => {
    stateRef.current = { ...stateRef.current, ...patch };
    setState(stateRef.current);
  }, []);

  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { draft, base } = stateRef.current;
    if (!draft || !base || saving.current) return;
    saving.current = true;
    update({ status: 'saving', error: null });
    try {
      const saved = await apiSaveTaskDocument(taskId, toServerContent(draft), base.revision);
      qc.setQueryData(documentQueryKey(taskId), saved);
      if (stateRef.current.draft === draft) {
        draftMemory.delete(taskId);
        update({ base: saved, draft: null, status: 'saved' });
      } else {
        draftMemory.set(taskId, { draft: stateRef.current.draft!, base: saved });
        update({ base: saved, status: 'dirty' });
        timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
      }
    } catch (err) {
      const current = conflictCurrent(err);
      if (current) update({ status: 'conflict', conflict: current });
      else update({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    } finally {
      saving.current = false;
    }
  }, [qc, taskId, update]);

  useEffect(() => {
    const data = query.data;
    if (!data) return;
    const current = stateRef.current;
    if (current.draft) {
      if (!current.base) update({ base: data });
      return;
    }
    if (current.base?.revision === data.revision && view.key > 0) return;
    update({ base: data, status: 'saved' });
    setView((prev) => ({ key: prev.key + 1, content: data.content }));
  }, [query.data, update, view.key]);

  const edit = useCallback((content: DocumentNode) => {
    const { base, status } = stateRef.current;
    if (base) draftMemory.set(taskId, { draft: content, base });
    if (status === 'conflict') {
      update({ draft: content });
      return;
    }
    update({ draft: content, status: saving.current ? 'saving' : 'dirty' });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }, [save, taskId, update]);

  const reload = useCallback(() => {
    const current = stateRef.current.conflict;
    if (!current) return;
    draftMemory.delete(taskId);
    qc.setQueryData(documentQueryKey(taskId), current);
    update({ base: current, draft: null, conflict: null, status: 'saved' });
    setView((prev) => ({ key: prev.key + 1, content: current.content }));
  }, [qc, taskId, update]);

  const keepMine = useCallback(() => {
    const current = stateRef.current.conflict;
    if (!current) return;
    update({ base: current, conflict: null, status: 'dirty' });
    void save();
  }, [save, update]);

  // Leaving the item saves a pending edit right away instead of dropping it.
  useEffect(() => () => {
    const { status, draft } = stateRef.current;
    if (draft && (status === 'dirty' || status === 'saving')) void save();
  }, [save]);

  return { state, view, query, edit, save, reload, keepMine };
}
