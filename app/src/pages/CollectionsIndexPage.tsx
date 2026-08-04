import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Plus, MoreHorizontal } from 'lucide-react';
import {
  fetchCollections,
  apiCreateCollection,
  apiDeleteCollection,
  apiUpdateCollection,
  PALETTE_COLORS,
  type ApiCollection,
} from '../api/client';
import { buildCollectionTree, type CollectionTreeNode } from '../stores/collectionStore';
import { ConfirmModal } from '../components/ConfirmModal';
import { useI18n } from '../i18n/I18nContext';

function useOnClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

interface CollectionRowProps {
  node: CollectionTreeNode;
  depth: number;
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
  renamingId: string | null;
  addingSubFor: string | null;
  editingName: string;
  setEditingName: (val: string) => void;
  onRename: (node: CollectionTreeNode) => void;
  onAddSub: (node: CollectionTreeNode) => void;
  onDelete: (node: CollectionTreeNode) => void;
  onSaveRename: (node: CollectionTreeNode) => void;
  onCancelRename: () => void;
  onSaveNewSub: (parentId: string) => void;
  onCancelNewSub: () => void;
}

function CollectionRow({ node, depth, ...props }: CollectionRowProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(menuRef, () => {
    if (props.menuOpenId === node.id) props.setMenuOpenId(null);
  });

  const isMenuOpen = props.menuOpenId === node.id;
  const isRenaming = props.renamingId === node.id;
  const isAddingSub = props.addingSubFor === node.id;

  return (
    <>
      <div
        className="collections-index-row grid h-6 cursor-pointer relative"
        style={{ gridTemplateColumns: `24px minmax(0, 1fr) 24px`, paddingLeft: `${depth * 24}px` }}
        onClick={() => {
          if (!isRenaming && !isMenuOpen) navigate(`/collection/${node.id}`);
        }}
      >
        <span
          className="w-2 h-2 rounded-full justify-self-center self-center translate-y-px shrink-0 [filter:saturate(0.55)]"
          style={{ backgroundColor: node.color }}
          aria-hidden="true"
        />

        {isRenaming ? (
          <input
            autoFocus
            type="text"
            value={props.editingName}
            onChange={(e) => props.setEditingName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') props.onSaveRename(node);
              if (e.key === 'Escape') props.onCancelRename();
            }}
            onBlur={() => props.onSaveRename(node)}
            className="col-start-2 col-span-1 min-w-0 h-6 text-sm leading-6 text-ink-light bg-transparent border-0 border-b border-dot outline-none px-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
          />
        ) : (
          <span className="col-start-2 col-span-1 flex h-6 min-w-0 items-center truncate text-sm leading-none text-ink-light">{node.name}</span>
        )}

        {!isRenaming && (
          <div className="col-start-3 col-span-1 flex h-6 items-center justify-self-end gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                className="collections-index-row__actions-btn flex h-6 w-6 items-center justify-center p-0 text-ink-light hover:text-ink bg-transparent border-0 cursor-pointer"
                aria-label={t('page.deleteNamed', { name: node.name })}
                onClick={() => props.setMenuOpenId(isMenuOpen ? null : node.id)}
              >
                <MoreHorizontal size={16} strokeWidth={1.5} />
              </button>
              {isMenuOpen && (
                <div className="collections-index-menu">
                  <button
                    type="button"
                    onClick={() => {
                      props.onRename(node);
                      props.setMenuOpenId(null);
                    }}
                  >
                    {t('common.rename')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      props.onAddSub(node);
                      props.setMenuOpenId(null);
                    }}
                  >
                    {t('page.addSubCollection')}
                  </button>
                  <button
                    type="button"
                    data-destructive
                    onClick={() => {
                      props.onDelete(node);
                      props.setMenuOpenId(null);
                    }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              )}
            </div>

            <ChevronRight size={16} className="self-center text-ink-light opacity-40" />
          </div>
        )}
      </div>

      {isAddingSub && (
        <div
          className="grid h-6"
          style={{ gridTemplateColumns: `24px minmax(0, 1fr) 24px`, paddingLeft: `${(depth + 1) * 24}px` }}
        >
          <span className="w-2 h-2 rounded-full justify-self-center self-center shrink-0 bg-dot" aria-hidden="true" />
          <input
            autoFocus
            type="text"
            placeholder={t('page.collectionName')}
            value={props.editingName}
            onChange={(e) => props.setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') props.onSaveNewSub(node.id);
              if (e.key === 'Escape') props.onCancelNewSub();
            }}
            onBlur={() => props.onSaveNewSub(node.id)}
            className="col-start-2 col-span-1 flex h-6 min-w-0 items-center text-sm leading-none text-ink-light bg-transparent border-0 border-b border-dot outline-none px-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
          />
        </div>
      )}

      {node.children.map((child) => (
        <CollectionRow key={child.id} node={child} depth={depth + 1} {...props} />
      ))}
    </>
  );
}

export function CollectionsIndexPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: rawCollections = [] } = useQuery<ApiCollection[]>({
    queryKey: ['collections'],
    queryFn: fetchCollections,
  });

  const collections = useMemo(() => buildCollectionTree(rawCollections), [rawCollections]);

  const [addingRoot, setAddingRoot] = useState(false);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CollectionTreeNode | null>(null);

  const nextColor = () => PALETTE_COLORS[rawCollections.length % PALETTE_COLORS.length];

  const startAddRoot = () => {
    setAddingRoot(true);
    setAddingSubFor(null);
    setRenamingId(null);
    setEditingName('');
    setMenuOpenId(null);
  };

  const handleSaveRoot = () => {
    const trimmed = editingName.trim();
    setAddingRoot(false);
    setEditingName('');
    if (!trimmed) return;
    apiCreateCollection({ name: trimmed, color: nextColor() })
      .then(() => qc.invalidateQueries({ queryKey: ['collections'] }))
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  const handleRename = (node: CollectionTreeNode) => {
    setRenamingId(node.id);
    setAddingRoot(false);
    setAddingSubFor(null);
    setEditingName(node.name);
  };

  const handleSaveRename = (node: CollectionTreeNode) => {
    const trimmed = editingName.trim();
    setRenamingId(null);
    setEditingName('');
    if (!trimmed || trimmed === node.name) return;
    apiUpdateCollection(node.id, { name: trimmed })
      .then(() => qc.invalidateQueries({ queryKey: ['collections'] }))
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  const handleAddSub = (node: CollectionTreeNode) => {
    setAddingSubFor(node.id);
    setAddingRoot(false);
    setRenamingId(null);
    setEditingName('');
  };

  const handleSaveNewSub = (parentId: string) => {
    const trimmed = editingName.trim();
    setAddingSubFor(null);
    setEditingName('');
    if (!trimmed) return;
    apiCreateCollection({ name: trimmed, parentId, color: nextColor() })
      .then(() => qc.invalidateQueries({ queryKey: ['collections'] }))
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    apiDeleteCollection(id)
      .then(() => {
        qc.invalidateQueries({ queryKey: ['collections'] });
        navigate('/collections');
      })
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  return (
    <div className="collections-index-page w-full max-w-2xl">
      <header className="page-header-copy">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg leading-6 font-semibold text-ink h-6">
              {t('nav.collections')}
            </h1>
            <p className="text-[13px] leading-6 text-ink-light opacity-60 mt-0">
              {t('page.collectionsSubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={startAddRoot}
            className="p-1.5 -mr-1.5 text-ink-light hover:text-ink bg-transparent border-0 cursor-pointer rounded-full hover:bg-[var(--planner-sidebar-hover-bg)] transition-colors"
            title={t('page.addCollection')}
            aria-label={t('page.addCollection')}
          >
            <Plus size={20} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <div className="h-6" />

      <div className="flex flex-col">
        {addingRoot && (
          <div className="flex items-center h-12 px-4">
            <span className="w-2.5 h-2.5 rounded-full mr-3 shrink-0 bg-dot" aria-hidden="true" />
            <input
              autoFocus
              type="text"
              placeholder={t('page.collectionName')}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRoot();
                if (e.key === 'Escape') {
                  setAddingRoot(false);
                  setEditingName('');
                }
              }}
              onBlur={handleSaveRoot}
              className="flex-1 min-w-0 h-6 text-sm leading-6 text-ink bg-transparent border-0 border-b border-dot outline-none px-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
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
              menuOpenId={menuOpenId}
              setMenuOpenId={setMenuOpenId}
              renamingId={renamingId}
              addingSubFor={addingSubFor}
              editingName={editingName}
              setEditingName={setEditingName}
              onRename={handleRename}
              onAddSub={handleAddSub}
              onDelete={setDeleteTarget}
              onSaveRename={handleSaveRename}
              onCancelRename={() => {
                setRenamingId(null);
                setEditingName('');
              }}
              onSaveNewSub={handleSaveNewSub}
              onCancelNewSub={() => {
                setAddingSubFor(null);
                setEditingName('');
              }}
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
    </div>
  );
}
