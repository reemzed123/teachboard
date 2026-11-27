import type { InkObject } from '../core/document/types';

// הקו שנכתב כרגע (לפני ההרמה) – כדי שמסך המקרן יראה את הכתיבה בזמן אמת.

let current: InkObject | null = null;
const listeners = new Set<() => void>();

export function setLiveInk(ink: InkObject | null): void {
  current = ink;
  for (const l of listeners) l();
}

export function getLiveInk(): InkObject | null {
  return current;
}

export function onLiveInk(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function hasLiveInkListeners(): boolean {
  return listeners.size > 0;
}
