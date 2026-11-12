export interface StatusRow {
  id: string;
  collection_id: string;
  name: string;
  color: string;
  order_value: number;
  next_status_mode: "default" | "custom" | "disabled";
  next_status_id: string | null;
  accept_status_id: string | null;
  reject_status_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Status {
  id: string;
  collectionId: string;
  name: string;
  color: string;
  orderValue: number;
  nextStatusMode: "default" | "custom" | "disabled";
  nextStatusId: string | null;
  acceptStatusId: string | null;
  rejectStatusId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStatusInput {
  name: string;
  color?: string;
}

export interface UpdateStatusInput {
  name?: string;
  color?: string;
  position?: number;
  nextStatusMode?: "default" | "custom" | "disabled";
  nextStatusId?: string | null;
  acceptStatusId?: string | null;
  rejectStatusId?: string | null;
}

export interface DeleteStatusOptions {
  reassignToStatusId?: string;
}
