import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Link, Navigate, Outlet, useMatch, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ConfirmModal } from '../components/ConfirmModal';
import { CollectionRow } from '../components/collections/CollectionRow';
import { CollectionSplitContext } from '../contexts/CollectionSplitContext';
import { useCollectionsTree } from '../hooks/useCollectionsTree';
import { useCollectionsViewStore } from '../stores/collectionsViewStore';
import { useSync } from '../hooks/useSync';
import { useI18n } from '../i18n/I18nContext';
import { CollectionNotFound } from '../components/collections/CollectionViewState';
import type { CollectionSplitDirection, CollectionTreeNode } from '../types/collections';
import { CollectionsPage } from './CollectionsPage';
import './collectionsLayout.css';

const COLLECTION_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function CollectionsDetailRoute() {
  const { id = '' } = useParams();
  return COLLECTION_ID.test(id) ? <CollectionsPage key={id} /> : <CollectionNotFound />;
}

export function CollectionsLayout() {
  const { t } = useI18n();
  const activeId = useMatch('/collection/:id')?.params.id;
  const navigate = useNavigate();
  const model = useCollectionsTree(activeId);
  const detailsRef = useRef<HTMLElement>(null);
  const split = useCollectionsViewStore((state) => state.split);
  const setSplit = useCollectionsViewStore((state) => state.setSplit);
  const restoredRef = useRef(false);

  useLayoutEffect(() => {
    if (detailsRef.current) detailsRef.current.scrollTop = 0;
  }, [activeId]);

  // Coming back to Collections reopens the last selection (kept in memory, lost on reload).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const remembered = useCollectionsViewStore.getState().activeId;
    if (!activeId && remembered) navigate(`/collection/${remembered}`, { replace: true });
  }, [activeId, navigate]);

  useEffect(() => {
    if (activeId && COLLECTION_ID.test(activeId) && !model.archivedActive) useCollectionsViewStore.getState().remember(activeId);
  }, [activeId, model.archivedActive]);

  useSync(useCallback((event) => {
    if (event.entityType === 'collection' && event.eventType === 'deleted') {
      useCollectionsViewStore.getState().forget(event.entityId);
      if (event.entityId === activeId) {
        navigate('/collections', { replace: true });
      }
    }
  }, [activeId, navigate]));

  const handleSplit = useCallback((collectionId: string, direction: CollectionSplitDirection) => {
    if (!activeId) {
      navigate(`/collection/${collectionId}`);
      return;
    }
    setSplit({ direction, collectionId });
  }, [activeId, navigate, setSplit]);

  const handleCloseSecondary = useCallback(() => {
    setSplit(null);
  }, [setSplit]);

  const handleClosePrimary = useCallback(() => {
    if (!split) return;
    navigate(`/collection/${split.collectionId}`, { replace: true });
    setSplit(null);
  }, [navigate, setSplit, split]);

  const hasSplitPane = Boolean(activeId && COLLECTION_ID.test(activeId) && !model.archivedActive && split);

  return (
    <CollectionSplitContext.Provider value={handleSplit}>
      <div className="collections-layout" data-detail={Boolean(activeId)}>
        <CollectionsTree
          {...model}
          onSplit={(node, direction) => handleSplit(node.id, direction)}
        />
        <section
          ref={detailsRef}
          className="collections-detail-pane"
          data-split={hasSplitPane ? split!.direction : undefined}
          aria-label={t('collections.details')}
        >
          {activeId && !hasSplitPane && (
            <Link to="/collections" className="collections-back text-sm text-ink-light">
              <ArrowLeft size={16} aria-hidden="true" />
              {t('collections.back')}
            </Link>
          )}
          {model.archivedActive ? (
            <Navigate to="/collections" replace />
          ) : hasSplitPane ? (
            <>
              <div className="collections-split-pane">
                <CollectionsPage key={activeId} collectionId={activeId} onClosePane={handleClosePrimary} />
              </div>
              <div className="collections-split-pane">
                <CollectionsPage
                  key={split!.collectionId}
                  collectionId={split!.collectionId}
                  onClosePane={handleCloseSecondary}
                />
              </div>
            </>
          ) : (
            <Outlet />
          )}
        </section>
      </div>
    </CollectionSplitContext.Provider>
  );
}

/** Nothing selected: the details pane stays empty. */
export function CollectionsLanding() {
  return null;
}

function CollectionsTree({
  collections, addingRoot, startAddRoot, handleSaveRoot, cancelEditing,
  deleteTarget, confirmDelete, setDeleteTarget, rowProps, onSplit,
}: ReturnType<typeof useCollectionsTree> & {
  onSplit: (node: CollectionTreeNode, direction: CollectionSplitDirection) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="collections-index-page collections-tree-pane w-full" aria-label={t('collections.tree')}>
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
