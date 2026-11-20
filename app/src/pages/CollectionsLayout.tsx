import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, Navigate, Outlet, useMatch, useNavigate, useOutletContext, useParams } from 'react-router';
import { ArrowLeft, Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ConfirmModal } from '../components/ConfirmModal';
import { CollectionRow } from '../components/collections/CollectionRow';
import { Button } from '../components/ui/Button';
import { CollectionSplitContext } from '../contexts/CollectionSplitContext';
import { PlannerDragEnabledContext } from '../contexts/usePlannerDrag';
import { useCollectionsTree } from '../hooks/useCollectionsTree';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useSync } from '../hooks/useSync';
import { useI18n } from '../i18n/I18nContext';
import { CollectionNotFound } from '../components/collections/CollectionViewState';
import type { CollectionSplitDirection, CollectionSplitPane, CollectionTreeNode } from '../types/collections';
import { CollectionsPage } from './CollectionsPage';
import './collectionsLayout.css';

const COLLECTION_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const NARROW_VIEWPORT_QUERY = '(max-width: 767px)';
const MAX_SECONDARY_PANES = 3;

export function CollectionsDetailRoute() {
  const { id = '' } = useParams();
  return COLLECTION_ID.test(id) ? <CollectionsPage key={id} /> : <CollectionNotFound />;
}

export function CollectionsLayout() {
  const { t } = useI18n();
  const activeId = useMatch('/collection/:id')?.params.id;
  const validActiveId = activeId && COLLECTION_ID.test(activeId) ? activeId : undefined;
  const navigate = useNavigate();
  const isNarrowViewport = useMediaQuery(NARROW_VIEWPORT_QUERY);
  const canSplit = !isNarrowViewport;
  const detailsRef = useRef<HTMLElement>(null);
  const splitSeqRef = useRef(0);
  const [split, setSplit] = useState<{ direction: CollectionSplitDirection; panes: CollectionSplitPane[] } | null>(null);
  const splitRef = useRef(split);
  useLayoutEffect(() => {
    splitRef.current = split;
  }, [split]);

  const handleCollectionDeleted = useCallback((deletedId: string) => {
    const current = splitRef.current;
    const remaining = current ? current.panes.filter((pane) => pane.collectionId !== deletedId) : [];

    if (deletedId === validActiveId) {
      if (remaining.length > 0 && current) {
        const [first, ...rest] = remaining;
        setSplit(rest.length > 0 ? { ...current, panes: rest } : null);
        navigate(`/collection/${first.collectionId}`, { replace: true });
      } else {
        setSplit(null);
        navigate('/collections', { replace: true });
      }
      return;
    }

    if (current && remaining.length !== current.panes.length) {
      setSplit(remaining.length > 0 ? { ...current, panes: remaining } : null);
    }
  }, [navigate, validActiveId]);

  const model = useCollectionsTree(activeId, { onCollectionDeleted: handleCollectionDeleted });

  useLayoutEffect(() => {
    if (detailsRef.current) detailsRef.current.scrollTop = 0;
  }, [activeId]);

  // Clear split panes when leaving detail view or when the active collection is archived.
  useEffect(() => {
    if (!validActiveId || model.archivedActive) {
      setSplit(null);
    }
  }, [validActiveId, model.archivedActive]);

  // Drop any secondary pane whose collection was deleted or archived.
  const activeCollectionIds = useMemo(() => {
    if (!model.collectionsLoaded) return null;
    return new Set(model.rawCollections.filter((c) => !c.isArchived).map((c) => c.id));
  }, [model.collectionsLoaded, model.rawCollections]);

  const livePanes = useMemo(() => {
    if (!split) return [];
    if (!activeCollectionIds) return split.panes;
    return split.panes.filter((pane) => activeCollectionIds.has(pane.collectionId));
  }, [activeCollectionIds, split]);

  useSync(useCallback((event) => {
    if (event.entityType === 'collection' && event.eventType === 'deleted') {
      handleCollectionDeleted(event.entityId);
    }
  }, [handleCollectionDeleted]));

  const handleSplit = useCallback((collectionId: string, direction: CollectionSplitDirection) => {
    if (!canSplit || !validActiveId || model.archivedActive) {
      navigate(`/collection/${collectionId}`);
      return;
    }
    setSplit((prev) => {
      const existing = prev?.panes ?? [];
      if (collectionId === validActiveId) {
        return existing.length > 0 ? { direction, panes: existing } : null;
      }
      if (existing.some((pane) => pane.collectionId === collectionId)) {
        return { direction, panes: existing };
      }
      if (existing.length >= MAX_SECONDARY_PANES) {
        return { direction, panes: existing };
      }
      const nextPane: CollectionSplitPane = {
        key: `${collectionId}-${++splitSeqRef.current}`,
        collectionId,
      };
      return { direction, panes: [...existing, nextPane] };
    });
  }, [canSplit, model.archivedActive, navigate, validActiveId]);

  const handleClosePane = useCallback((paneKey: string) => {
    setSplit((prev) => {
      if (!prev) return null;
      const panes = prev.panes.filter((pane) => pane.key !== paneKey);
      return panes.length > 0 ? { ...prev, panes } : null;
    });
  }, []);

  const handleClosePrimary = useCallback(() => {
    const current = splitRef.current;
    if (!current || current.panes.length === 0) return;
    const panes = activeCollectionIds
      ? current.panes.filter((pane) => activeCollectionIds.has(pane.collectionId))
      : current.panes;
    if (panes.length === 0) {
      setSplit(null);
      return;
    }
    const [first, ...rest] = panes;
    setSplit(rest.length > 0 ? { ...current, panes: rest } : null);
    navigate(`/collection/${first.collectionId}`, { replace: true });
  }, [activeCollectionIds, navigate]);

  const handleNavigateSecondaryPane = useCallback((paneKey: string, targetId: string) => {
    setSplit((prev) => {
      if (!prev) return null;
      const panes = prev.panes.map((pane) =>
        pane.key === paneKey ? { ...pane, collectionId: targetId } : pane,
      );
      return { ...prev, panes };
    });
  }, []);

  const hasSplitPanes = Boolean(canSplit && validActiveId && !model.archivedActive && split && livePanes.length > 0);
  const splitStyle = hasSplitPanes
    ? ({ '--split-count': 1 + livePanes.length } as CSSProperties)
    : undefined;

  const splitContextValue = useMemo(
    () => ({
      onSplit: canSplit ? handleSplit : undefined,
      onCollectionDeleted: handleCollectionDeleted,
    }),
    [canSplit, handleCollectionDeleted, handleSplit],
  );

  return (
    <CollectionSplitContext.Provider value={splitContextValue}>
      <div className="collections-layout" data-detail={Boolean(activeId)}>
        <CollectionsTree
          {...model}
          onSplit={canSplit ? (node, direction) => handleSplit(node.id, direction) : undefined}
        />
        <section
          ref={detailsRef}
          className="collections-detail-pane"
          data-split={hasSplitPanes ? split!.direction : undefined}
          style={splitStyle}
          aria-label={t('collections.details')}
        >
          {activeId && !hasSplitPanes && (
            <Link to="/collections" className="collections-back text-sm text-ink-light">
              <ArrowLeft size={16} aria-hidden="true" />
              {t('collections.back')}
            </Link>
          )}
          {model.archivedActive ? (
            <Navigate to="/collections" replace />
          ) : validActiveId ? (
            <>
              <div className={hasSplitPanes ? 'collections-split-pane' : undefined}>
                <CollectionsPage
                  key={validActiveId}
                  collectionId={validActiveId}
                  onClosePane={hasSplitPanes ? handleClosePrimary : undefined}
                />
              </div>
              {hasSplitPanes && livePanes.map((pane) => (
                <div key={pane.key} className="collections-split-pane">
                  <PlannerDragEnabledContext.Provider value={false}>
                    <CollectionsPage
                      collectionId={pane.collectionId}
                      isSecondaryPane
                      onClosePane={() => handleClosePane(pane.key)}
                      onNavigateCollection={(targetId) => handleNavigateSecondaryPane(pane.key, targetId)}
                    />
                  </PlannerDragEnabledContext.Provider>
                </div>
              ))}
            </>
          ) : (
            <Outlet context={model.startAddRoot} />
          )}
        </section>
      </div>
    </CollectionSplitContext.Provider>
  );
}

export function CollectionsLanding() {
  const { t } = useI18n();
  const startAddRoot = useOutletContext<() => void>();
  return (
    <div className="collections-landing">
      <h2 className="m-0 font-semibold text-ink">{t('collections.select')}</h2>
      <Button variant="secondary" onClick={startAddRoot}>{t('collections.new')}</Button>
    </div>
  );
}

function CollectionsTree({
  collections, addingRoot, startAddRoot, handleSaveRoot, cancelEditing,
  deleteTarget, confirmDelete, setDeleteTarget, rowProps, onSplit,
}: ReturnType<typeof useCollectionsTree> & {
  onSplit?: (node: CollectionTreeNode, direction: CollectionSplitDirection) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="collections-index-page collections-tree-pane" aria-label={t('collections.tree')}>
      <PageHeader
        title={t('nav.collections')}
        toolbar={
          <div className="page-header-toolbar">
            <button
              type="button"
              onClick={startAddRoot}
              className="flex h-6 w-6 items-center justify-center p-0 text-ink-light hover:text-ink bg-transparent border-0 cursor-pointer rounded-full hover:bg-(--planner-sidebar-hover-bg) transition-colors"
              title={t('page.addCollection')}
              aria-label={t('page.addCollection')}
            >
              <Plus size={16} strokeWidth={1.5} />
            </button>
          </div>
        }
      />

      <div className="h-6" />

      <div className="flex flex-col">
        {addingRoot && (
          <div
            className="collections-index-input-row grid h-6 items-center"
            style={{ gridTemplateColumns: '24px minmax(0, 1fr)' }}
          >
            <span
              className="w-1.75 h-1.75 rounded-full justify-self-center self-center translate-y-px shrink-0 bg-border-subtle"
              aria-hidden="true"
            />
            <input
              autoFocus
              type="text"
              aria-label={t('page.collectionName')}
              placeholder={t('page.collectionName')}
              value={rowProps.editingName}
              onChange={(e) => rowProps.setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRoot();
                if (e.key === 'Escape') {
                  cancelEditing();
                }
              }}
              onBlur={handleSaveRoot}
              className="collections-inline-input col-start-2 min-w-0 w-full h-6 text-sm leading-6 text-ink bg-transparent border-0 border-b border-border-subtle px-0 placeholder:text-ink-light/45"
            />
          </div>
        )}

        {collections.length === 0 && !addingRoot ? (
          <div className="px-4 py-12 text-center text-ink-light opacity-60 text-sm italic">
            {t('page.noCollections')}
          </div>
        ) : (
          collections.map((node) => (
            <CollectionRow
              key={node.id}
              node={node}
              depth={0}
              {...rowProps}
              onSplit={onSplit}
            />
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title={t('page.deleteCollection')}
        message={deleteTarget ? t('page.deleteCollectionMessage', { name: deleteTarget.name }) : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
