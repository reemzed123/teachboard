import { applyOps, invertOps, type Op } from './ops';
import type { BoardDocument } from './types';

// היסטוריית פעולות לביטול (Undo) וביצוע חוזר (Redo).

export interface HistoryEntry {
  /** שם הפעולה (לתצוגה עתידית של היסטוריה) */
  label: string;
  redo: Op[];
  undo: Op[];
}

export interface History {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export const HISTORY_LIMIT = 500;

export function emptyHistory(): History {
  return { past: [], future: [] };
}

export interface DocState {
  doc: BoardDocument;
  history: History;
}

/** מבצע פעולות ורושם אותן בהיסטוריה. פעולה חדשה מוחקת את אפשרות ה-Redo. */
export function commit(state: DocState, label: string, ops: readonly Op[]): DocState {
  if (ops.length === 0) return state;
  const undo = invertOps(state.doc, ops);
  const doc = applyOps(state.doc, ops);
  const past = [...state.history.past, { label, redo: [...ops], undo }];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  return { doc, history: { past, future: [] } };
}

export function undo(state: DocState): DocState {
  const entry = state.history.past.at(-1);
  if (!entry) return state;
  return {
    doc: applyOps(state.doc, entry.undo),
    history: { past: state.history.past.slice(0, -1), future: [entry, ...state.history.future] },
  };
}

export function redo(state: DocState): DocState {
  const entry = state.history.future[0];
  if (!entry) return state;
  return {
    doc: applyOps(state.doc, entry.redo),
    history: { past: [...state.history.past, entry], future: state.history.future.slice(1) },
  };
}
