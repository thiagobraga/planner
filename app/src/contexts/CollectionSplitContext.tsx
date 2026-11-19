import { createContext, useContext } from 'react';
import type { CollectionSplitDirection } from '../types/collections';

type SplitCollectionHandler = (collectionId: string, direction: CollectionSplitDirection) => void;

export const CollectionSplitContext = createContext<SplitCollectionHandler | undefined>(undefined);

export function useCollectionSplit(): SplitCollectionHandler | undefined {
  return useContext(CollectionSplitContext);
}
