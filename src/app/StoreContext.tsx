import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { AppState, AppStore } from './store';

export const StoreContext = createContext<AppStore | null>(null);

export function useAppStore(): AppStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useAppStore must be used inside <StoreContext.Provider>');
  return store;
}

export function useApp<T>(selector: (state: AppState) => T): T {
  return useStore(useAppStore(), selector);
}
