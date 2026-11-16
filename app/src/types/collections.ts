import type { ApiCollection } from './api';
import type { StoreSection, Task } from './task';

export interface FlatCollection {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  depth: number;
}

export interface CollectionTreeRowProps {
  item: FlatCollection;
  depth: number;
  isActive: boolean;
  isEditing: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  draft: string;
  onNavigate: () => void;
  onStartRename: () => void;
  onDraftChange: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onToggleCollapsed: () => void;
  onAddSub: () => void;
  onDelete: () => void;
  onColorCommit: (color: string) => void;
}

export interface CollectionMenuHandlers {
  onChangeColor: () => void;
  onStartRename: () => void;
  onAddSub: () => void;
  onDelete: () => void;
}

export interface CollectionTreeNode {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  orderValue: number;
  isInbox: boolean;
  children: CollectionTreeNode[];
}

export interface CollectionState {
  collections: ApiCollection[];
  setCollections: (collections: ApiCollection[]) => void;
  addCollection: (collection: ApiCollection) => void;
  updateCollection: (id: string, updates: Partial<ApiCollection>) => void;
  removeCollection: (id: string) => void;
}

export interface CollectionRowProps {
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
  onColorCommit: (node: CollectionTreeNode, color: string) => void;
}

export interface SectionHeaderProps {
  section: StoreSection;
  collectionId: string;
  isEditing: boolean;
  onEdit: () => void;
  onCommitName: (name: string) => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onRightClick?: (position: { x: number; y: number }) => void;
}

export interface SectionDeleteModalProps {
  isOpen: boolean;
  sectionName: string;
  taskCount: number;
  onDeleteTasks: () => void;
  onMoveToTopLevel: () => void;
  onCancel: () => void;
}

export interface CollectionCrumb {
  id: string;
  name: string;
  color: string;
}

export interface CollectionCrumbMenuState {
  collectionId: string;
  position: { x: number; y: number };
}

export interface CollectionCrumbColorPickerState {
  collectionId: string;
  color: string;
  position: { x: number; y: number };
}

export interface DeletingCollectionState {
  id: string;
  name: string;
}

export interface DeletingSectionState {
  id: string;
  name: string;
  taskCount: number;
}

export interface SectionContextMenuState {
  sectionId: string;
  position: { x: number; y: number };
}

export interface SectionGroup {
  section: StoreSection | null;
  tasks: Task[];
}

export interface CollectionBreadcrumbTitleProps {
  trail: CollectionCrumb[];
  renamingCrumbId: string | null;
  crumbDraft: string;
  onDraftChange: (value: string) => void;
  onCommitRename: (collectionId: string) => void;
  onCancelRename: () => void;
  onOpenMenu: (state: CollectionCrumbMenuState) => void;
}

export interface CollectionSubInputProps {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

export interface CollectionBreadcrumbOverlaysProps {
  trail: CollectionCrumb[];
  crumbMenu: CollectionCrumbMenuState | null;
  onCloseMenu: () => void;
  onOpenColorPicker: (state: CollectionCrumbColorPickerState) => void;
  onStartRename: (collectionId: string, currentName: string) => void;
  onStartAddSub: (collectionId: string) => void;
  onRequestDelete: (target: DeletingCollectionState) => void;
  crumbColorPicker: CollectionCrumbColorPickerState | null;
  onCommitColor: (collectionId: string, color: string) => void;
  onCloseColorPicker: () => void;
  deletingCollection: DeletingCollectionState | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}
