import { Fragment } from 'react';
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { ContextMenu } from '../ui/ContextMenu';
import { ColorPickerPopover } from '../ui/ColorPickerPopover';
import { buildCollectionMenuItems } from '../collectionMenuItems';
import { ConfirmModal } from '../ConfirmModal';
import type {
  CollectionBreadcrumbOverlaysProps,
  CollectionBreadcrumbTitleProps,
  CollectionSubInputProps,
} from '../../types/collections';

export function CollectionBreadcrumbTitle({
  trail,
  renamingCrumbId,
  crumbDraft,
  onDraftChange,
  onCommitRename,
  onCancelRename,
  onOpenMenu,
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
                className="w-1.75 h-1.75 shrink-0 rounded-full"
                style={{ background: crumb.color }}
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
                  className="min-w-0 flex-1 border-0 border-b border-dot bg-transparent p-0 text-lg leading-6 font-semibold text-ink outline-none"
                />
              ) : isCurrent ? (
                <span className="truncate">{crumb.name}</span>
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
    <div className="collections-page-sub-input flex h-6 items-center">
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
        className="h-6 w-full min-w-0 border-0 border-b border-dot bg-transparent p-0 text-[13px] leading-6 text-ink outline-none"
      />
    </div>
  );
}

export function CollectionBreadcrumbOverlays({
  trail,
  crumbMenu,
  onCloseMenu,
  onOpenColorPicker,
  onStartRename,
  onStartAddSub,
  onRequestDelete,
  crumbColorPicker,
  onCommitColor,
  onCloseColorPicker,
  deletingCollection,
  onConfirmDelete,
  onCancelDelete,
}: CollectionBreadcrumbOverlaysProps) {
  const { t } = useI18n();

  return (
    <>
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
