import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight, FolderPlus, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { ContextMenu } from '../ui/ContextMenu';
import { ColorPickerPopover } from '../ui/ColorPickerPopover';
import { buildCollectionMenuItems } from '../collectionMenuItems';
import { ConfirmModal } from '../ConfirmModal';
import type { ContextMenuItem } from '../../types/contextMenu';
import type {
  CollectionBreadcrumbOverlaysProps,
  CollectionBreadcrumbTitleProps,
  CollectionSubInputProps,
} from '../../types/collections';

export function CollectionHeaderActions({
  toolbar,
  onClosePane,
}: {
  toolbar: ReactNode;
  onClosePane?: () => void;
}) {
  const { t } = useI18n();
  if (!onClosePane) return <>{toolbar}</>;
  return (
    <div className="flex items-center gap-1">
      {toolbar}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClosePane();
        }}
        aria-label={t('collections.closePane')}
        title={t('collections.closePane')}
        className="collections-split-pane__close flex h-6 w-6 items-center justify-center rounded-full border-0 bg-transparent p-0 text-ink-light hover:bg-(--planner-sidebar-hover-bg) hover:text-ink cursor-pointer transition-colors"
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}

export function CollectionBreadcrumbTitle({
  trail,
  renamingCrumbId,
  crumbDraft,
  onDraftChange,
  onCommitRename,
  onCancelRename,
  onOpenMenu,
  onOpenColorPicker,
  onOpenChildrenMenu,
  childrenMenuOpen,
}: CollectionBreadcrumbTitleProps) {
  const { t } = useI18n();

  return (
    <>
      {trail.map((crumb, i) => {
        const isCurrent = i === trail.length - 1;
        return (
          <Fragment key={crumb.id}>
            {i > 0 && (
              <ChevronRight
                size={13}
                className="collections-page-title-separator font-normal mx-1 text-ink-light opacity-50"
                aria-hidden="true"
              />
            )}
            <span
              className="collections-page-crumb flex min-w-0 items-center gap-2"
              onContextMenu={(e) => {
                e.preventDefault();
                onOpenMenu({ collectionId: crumb.id, position: { x: e.clientX, y: e.clientY } });
              }}
            >
              <span
                aria-hidden="true"
                title={t('page.changeColor')}
                className="collections-page-crumb-dot w-1.75 h-1.75 shrink-0 rounded-full cursor-pointer transition-transform hover:scale-125"
                style={{ background: crumb.color }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  onOpenColorPicker({
                    collectionId: crumb.id,
                    color: crumb.color,
                    position: { x: rect.left, y: rect.bottom },
                  });
                }}
              />
              {renamingCrumbId === crumb.id ? (
                <input
                  autoFocus
                  aria-label={t('common.rename')}
                  value={crumbDraft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onBlur={() => onCommitRename(crumb.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onCommitRename(crumb.id);
                    if (e.key === 'Escape') onCancelRename();
                  }}
                  className="collections-inline-input min-w-0 flex-1 border-0 border-b border-border-subtle bg-transparent p-0 text-lg leading-6 font-semibold text-ink"
                />
              ) : isCurrent ? (
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={childrenMenuOpen}
                  className="collections-page-crumb-trigger truncate bg-transparent border-0 p-0 font-inherit text-inherit cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    onOpenChildrenMenu({ x: rect.left, y: rect.bottom });
                  }}
                >
                  {crumb.name}
                </button>
              ) : (
                <Link
                  to={`/collection/${crumb.id}`}
                  className="truncate text-ink-light transition-colors hover:text-ink"
                >
                  {crumb.name}
                </Link>
              )}
            </span>
          </Fragment>
        );
      })}
    </>
  );
}

export function CollectionSubInput({
  isOpen,
  value,
  onChange,
  onCommit,
  onCancel,
}: CollectionSubInputProps) {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div className="collections-page-sub-input flex h-6 items-center gap-2">
      <span
        className="w-1.75 h-1.75 rounded-full shrink-0 bg-border-subtle"
        aria-hidden="true"
      />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={t('page.collectionName')}
        className="collections-inline-input h-6 w-full min-w-0 border-0 border-b border-border-subtle bg-transparent p-0 text-sm leading-6 text-ink placeholder:text-ink-light/45"
      />
    </div>
  );
}

export function CollectionBreadcrumbOverlays({
  trail,
  currentCollectionId,
  childCollections,
  childrenMenu,
  onCloseChildrenMenu,
  onNavigateCollection,
  crumbMenu,
  onCloseMenu,
  onOpenColorPicker,
  onStartRename,
  onStartAddSub,
  onSplit,
  onRequestDelete,
  crumbColorPicker,
  onCommitColor,
  onCloseColorPicker,
  deletingCollection,
  onConfirmDelete,
  onCancelDelete,
}: CollectionBreadcrumbOverlaysProps) {
  const { t } = useI18n();

  const childrenMenuItems: ContextMenuItem[] = [
    ...childCollections.map((child): ContextMenuItem => ({
      type: 'item',
      label: child.name,
      icon: (
        <span
          className="inline-block w-1.75 h-1.75 rounded-full shrink-0 filter-[saturate(0.55)]"
          style={{ backgroundColor: child.color }}
          aria-hidden="true"
        />
      ),
      onClick: () => onNavigateCollection(child.id),
    })),
    ...(childCollections.length > 0 ? [{ type: 'separator' as const }] : []),
    {
      type: 'item',
      label: t('page.addSubCollection'),
      icon: <FolderPlus size={14} />,
      onClick: () => onStartAddSub(currentCollectionId),
    },
  ];

  return (
    <>
      {childrenMenu && (
        <ContextMenu
          position={childrenMenu.position}
          onClose={onCloseChildrenMenu}
          items={childrenMenuItems}
        />
      )}

      {crumbMenu && (
        <ContextMenu
          position={crumbMenu.position}
          onClose={onCloseMenu}
          items={buildCollectionMenuItems(t, {
            onChangeColor: () =>
              onOpenColorPicker({
                collectionId: crumbMenu.collectionId,
                color: trail.find((c) => c.id === crumbMenu.collectionId)?.color ?? '#65788a',
                position: crumbMenu.position,
              }),
            onStartRename: () =>
              onStartRename(
                crumbMenu.collectionId,
                trail.find((c) => c.id === crumbMenu.collectionId)?.name ?? '',
              ),
            onAddSub: () => onStartAddSub(crumbMenu.collectionId),
            ...(onSplit
              ? {
                  onSplitVertically: () => onSplit(crumbMenu.collectionId, 'vertical'),
                  onSplitHorizontally: () => onSplit(crumbMenu.collectionId, 'horizontal'),
                }
              : {}),
            onDelete: () =>
              onRequestDelete({
                id: crumbMenu.collectionId,
                name: trail.find((c) => c.id === crumbMenu.collectionId)?.name ?? '',
              }),
          })}
        />
      )}

      {crumbColorPicker && (
        <ColorPickerPopover
          position={crumbColorPicker.position}
          value={crumbColorPicker.color}
          onCommit={(color) => onCommitColor(crumbColorPicker.collectionId, color)}
          onClose={onCloseColorPicker}
        />
      )}

      <ConfirmModal
        isOpen={deletingCollection !== null}
        title={t('page.deleteCollection')}
        message={t('page.deleteCollectionMessage', { name: deletingCollection?.name ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    </>
  );
}
