import type { ApiCollection } from './api';
import type { StoreSection } from './task';

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
