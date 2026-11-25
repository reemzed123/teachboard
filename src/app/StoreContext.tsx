import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { BoardState } from '../features/board/boardStore';
import type { AppRuntime } from './runtime';
import type { AppState, AppStore } from './store';

export const RuntimeContext = createContext<AppRuntime | null>(null);

export function useRuntime(): AppRuntime {
  const rt = useContext(RuntimeContext);
  if (!rt) throw new Error('useRuntime must be used inside <RuntimeContext.Provider>');
  return rt;
}

export function useAppStore(): AppStore {
  return useRuntime().app;
}

export function useApp<T>(selector: (state: AppState) => T): T {
  return useStore(useRuntime().app, selector);
}

export function useBoard<T>(selector: (state: BoardState) => T): T {
  return useStore(useRuntime().board, selector);
}
