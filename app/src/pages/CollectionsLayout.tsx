import { useCallback, useLayoutEffect, useRef } from 'react';
import { Link, Navigate, Outlet, useMatch, useNavigate, useOutletContext, useParams } from 'react-router';
import { ArrowLeft, Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ConfirmModal } from '../components/ConfirmModal';
import { CollectionRow } from '../components/collections/CollectionRow';
import { Button } from '../components/ui/Button';
import { useCollectionsTree } from '../hooks/useCollectionsTree';
import { useSync } from '../hooks/useSync';
import { useI18n } from '../i18n/I18nContext';
import { CollectionNotFound } from '../components/collections/CollectionViewState';
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
  useLayoutEffect(() => {
    if (detailsRef.current) detailsRef.current.scrollTop = 0;
  }, [activeId]);

  useSync(useCallback((event) => {
    if (event.entityType === 'collection' && event.eventType === 'deleted' && event.entityId === activeId) {
      navigate('/collections', { replace: true });
    }
  }, [activeId, navigate]));

  return (
    <div className="collections-layout" data-detail={Boolean(activeId)}>
      <CollectionsTree {...model} />
      <section ref={detailsRef} className="collections-detail-pane" aria-label={t('collections.details')}>
        {activeId && (
          <Link to="/collections" className="collections-back text-sm text-ink-light">
            <ArrowLeft size={16} aria-hidden="true" />
            {t('collections.back')}
          </Link>
        )}
        {model.archivedActive ? <Navigate to="/collections" replace /> : <Outlet context={model.startAddRoot} />}
      </section>
    </div>
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
  deleteTarget, confirmDelete, setDeleteTarget, rowProps,
}: ReturnType<typeof useCollectionsTree>) {
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
          <div className="flex items-center h-12 px-4">
            <span className="w-2.5 h-2.5 rounded-full mr-3 shrink-0 bg-border-subtle" aria-hidden="true" />
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
              className="flex-1 min-w-0 h-6 text-sm leading-6 text-ink bg-transparent border-0 border-b border-border-subtle outline-none px-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
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
