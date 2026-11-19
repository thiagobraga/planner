import { createContext, useContext } from 'react';
import type { CollectionSplitDirection } from '../types/collections';

type SplitCollectionHandler = (collectionId: string, direction: CollectionSplitDirection) => void;
type CollectionDeletedHandler = (collectionId: string) => void;

export interface CollectionSplitContextValue {
  onSplit?: SplitCollectionHandler;
  onCollectionDeleted?: CollectionDeletedHandler;
}

export const CollectionSplitContext = createContext<CollectionSplitContextValue>({});

export function useCollectionSplit(): SplitCollectionHandler | undefined {
  return useContext(CollectionSplitContext).onSplit;
}

export function useCollectionDeleted(): CollectionDeletedHandler | undefined {
  return useContext(CollectionSplitContext).onCollectionDeleted;
}
