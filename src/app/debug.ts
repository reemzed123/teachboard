import { newId } from '../core/document/ids';
import { IDENTITY_TRANSFORM, type InkObject } from '../core/document/types';
import type { AppRuntime } from './runtime';
import { unionRects } from '../core/geometry/rect';
import { objectBounds } from '../core/objects/geometry';
import { currentPage } from '../features/board/boardStore';
import { solveNow } from '../engine/render/geoCache';

// כלי בדיקה בלבד: זמינים רק כשהכתובת כוללת ‎?debug=1 (לבדיקות ביצועים אוטומטיות).
// לא משנים מידע של המשתמש מעבר למה שהבדיקה מבקשת במפורש.

export function installDebugHooks(rt: AppRuntime): () => void {
  if (typeof window === 'undefined' || !new URLSearchParams(location.search).has('debug')) {
    return () => undefined;
  }
  const api = {
    /** מוסיף n קווים סינתטיים ומחזיר כמה זמן לקח (מ"ש). */
    addSyntheticStrokes(n: number): number {
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const objects: InkObject[] = [];
      for (let i = 0; i < n; i++) {
        const points: number[] = [];
        for (let k = 0; k < 50; k++) points.push(k * 4, Math.sin(k / 5) * 20 + rnd() * 3, 0.5);
        objects.push({
          id: newId(),
          type: 'ink',
          transform: { ...IDENTITY_TRANSFORM, x: rnd() * 3000 - 1000, y: rnd() * 2000 - 600 },
          style: { kind: 'pen', color: '#1c2430', width: 4, opacity: 1 },
          points,
          pressure: false,
        });
      }
      const s = rt.board.getState();
      const t0 = performance.now();
      s.commit('debug', [{ type: 'add', pageId: s.pageId, objects }]);
      return performance.now() - t0;
    },
    /** גבולות הבחירה במסך (לבדיקות ידיות סיבוב/הגדלה) */
    selectionScreenBounds() {
      const s = rt.board.getState();
      const ids = new Set(s.selection);
      const b = unionRects(
        currentPage(s)
          .objects.filter((o) => ids.has(o.id))
          .map(objectBounds),
      );
      if (!b) return null;
      const v = s.view;
      return {
        x: b.x * v.scale + v.x,
        y: b.y * v.scale + v.y,
        width: b.width * v.scale,
        height: b.height * v.scale,
      };
    },
    /** הפתרון (מיקומים) של הבנייה הגיאומטרית בעמוד – לבדיקות */
    async geoSolution() {
      const s = rt.board.getState();
      const g = currentPage(s).objects.find((o) => o.type === 'geometry');
      if (!g || g.type !== 'geometry') return null;
      const sol = await solveNow(g);
      return Object.fromEntries(
        g.elements.map((e) => [e.style.label ?? e.id, { kind: e.kind, ...sol.get(e.id) }]),
      );
    },
    runtime: rt,
  };
  (window as unknown as { __tb?: typeof api }).__tb = api;
  return () => {
    delete (window as unknown as { __tb?: typeof api }).__tb;
  };
}
