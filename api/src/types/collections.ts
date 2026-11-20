export interface CollectionRow {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  color: string;
  is_inbox: boolean;
  is_archived: boolean;
  order_value: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCollectionInput {
  name: string;
  color: string;
  parentId?: string | null;
}

export interface UpdateCollectionInput {
  name?: string;
  color?: string;
  parentId?: string | null;
  orderValue?: number;
}

export interface SectionRow {
  id: string;
  collection_id: string;
  name: string;
  order_value: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSectionInput {
  name: string;
}

export interface UpdateSectionInput {
  name?: string;
  position?: number;
}

export interface InvitationRow {
  id: string;
  collection_id: string;
  email: string;
  token_hash: string;
  accepted_at: string | null;
  created_at: string;
}

export interface CollaboratorRow {
  id: string;
  collection_id: string;
  user_id: string;
  created_at: string;
}

export interface LabelRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLabelInput {
  name: string;
  color: string;
}

export interface UpdateLabelInput {
  name?: string;
  color?: string;
}
