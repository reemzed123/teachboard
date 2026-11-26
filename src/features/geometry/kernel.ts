// "מחשבון" הבנייה הגיאומטרית: JSXGraph במצב חישוב בלבד (בלי ציור).
// מקבל את רשימת הצעדים מהמסמך ומחזיר את המיקומים של כל אלמנט.
// הקובץ נטען רק כשיש בשיעור בנייה גיאומטרית.
import JXG from 'jsxgraph';
import type { GeoElement, GeometryObject } from '../../core/document/types';
import {
  angleAt,
  dist,
  polygonArea,
  polygonPerimeter,
  type Solution,
  type Solved,
} from '../../core/geometry/construction';

/* eslint-disable @typescript-eslint/no-explicit-any -- ממשק JSXGraph אינו מוקלד במלואו */
type JxEl = any;
type JxBoard = any;

interface Entry {
  sig: string;
  board: JxBoard;
  els: Map<string, JxEl>;
}

const boards = new Map<string, Entry>();
let counter = 0;

function newBoard(): JxBoard {
  const host = document.createElement('div');
  host.id = `tb-jxg-${++counter}`;
  host.style.display = 'none';
  document.body.append(host);
  return JXG.JSXGraph.initBoard(host.id, {
    renderer: 'no',
    boundingbox: [-1e5, 1e5, 1e5, -1e5],
    axis: false,
    showNavigation: false,
    showCopyright: false,
  });
}

function freeBoard(b: JxBoard) {
  const id = b.containerObj?.id;
  try {
    JXG.JSXGraph.freeBoard(b);
  } catch {
    // לא קריטי
  }
  if (id) document.getElementById(id)?.remove();
}

/** "חתימה" של המבנה, בלי המיקומים של נקודות חופשיות – אם לא השתנתה, רק מזיזים */
function signature(elements: readonly GeoElement[]): string {
  return JSON.stringify(
    elements.map((e) => [e.id, e.kind, e.parents, e.params ? { ...e.params, x: 0, y: 0 } : 0]),
  );
}

/** קודקוד k של מצולע משוכלל בן n צלעות על הצלע AB */
function regularVertex(ax: number, ay: number, bx: number, by: number, n: number, k: number) {
  const ext = (2 * Math.PI) / n;
  let px = ax,
    py = ay,
    qx = bx,
    qy = by;
  for (let i = 2; i <= k; i++) {
    const dx = qx - px;
    const dy = qy - py;
    const c = Math.cos(ext);
    const s = Math.sin(ext);
    const nx = qx + dx * c - dy * s;
    const ny = qy + dx * s + dy * c;
    px = qx;
    py = qy;
    qx = nx;
    qy = ny;
  }
  return { x: qx, y: qy };
}

function build(board: JxBoard, elements: readonly GeoElement[]): Map<string, JxEl> {
  const els = new Map<string, JxEl>();
  const g = (id: string | undefined) => (id ? els.get(id) : undefined);
  const opt = { visible: false, withLabel: false };
  for (const e of elements) {
    const P = e.parents.map((id) => g(id));
    if (P.some((p) => !p) && e.kind !== 'polygon' && e.kind !== 'angle' && e.kind !== 'measure')
      continue;
    const [a, b, c] = P;
    const pr = e.params ?? {};
    try {
      let el: JxEl;
      switch (e.kind) {
        case 'point':
          el = board.create('point', [pr.x ?? 0, pr.y ?? 0], opt);
          break;
        case 'glider':
          el = board.create('glider', [pr.x ?? 0, pr.y ?? 0, a], opt);
          break;
        case 'midpoint':
          el = board.create('midpoint', [a, b], opt);
          break;
        case 'intersection':
          el = board.create('intersection', [a, b, pr.index ?? 0], opt);
          break;
        case 'foot':
          el = board.create('perpendicularpoint', [a, b], opt);
          break;
        case 'regularVertex': {
          const n = pr.n ?? 4;
          const k = pr.k ?? 2;
          el = board.create(
            'point',
            [
              () => regularVertex(a.X(), a.Y(), b.X(), b.Y(), n, k).x,
              () => regularVertex(a.X(), a.Y(), b.X(), b.Y(), n, k).y,
            ],
            opt,
          );
          break;
        }
        case 'segment':
          el = board.create('segment', [a, b], opt);
          break;
        case 'line':
          el = board.create('line', [a, b], opt);
          break;
        case 'ray':
          el = board.create('line', [a, b], { ...opt, straightFirst: false, straightLast: true });
          break;
        case 'parallel':
          el = board.create('parallel', [a, b], opt);
          break;
        case 'perpendicular':
          el = board.create('perpendicular', [a, b], opt);
          break;
        case 'perpBisector': {
          // אנך אמצעי = אנך לקטע AB דרך האמצע שלו
          const mid = board.create('midpoint', [a, b], opt);
          const ab = board.create('line', [a, b], opt);
          el = board.create('perpendicular', [ab, mid], opt);
          break;
        }
        case 'angleBisector':
          el = board.create('bisector', [a, b, c], opt);
          break;
        case 'circle':
          el = board.create('circle', [a, b], opt);
          break;
        case 'circleR':
          el = board.create('circle', [a, Math.max(0.001, pr.r ?? 1)], opt);
          break;
        case 'circle3':
          el = board.create('circumcircle', [a, b, c], opt);
          break;
        case 'arc':
          el = board.create('arc', [a, b, c], opt);
          break;
        case 'ellipse':
          el = board.create('ellipse', [a, b, c], opt);
          break;
        default:
          continue; // מצולע, זווית ומדידה – מחושבים בלי JSXGraph
      }
      els.set(e.id, el);
    } catch {
      // צעד שלא ניתן לבנות (למשל הורים שנמחקו) – פשוט לא מוצג
    }
  }
  return els;
}

const ok = (...v: number[]) => v.every((n) => Number.isFinite(n));

/** מחשב את כל המיקומים בבנייה */
export function solve(obj: GeometryObject): Solution {
  const sig = signature(obj.elements);
  let entry = boards.get(obj.id);
  if (!entry || entry.sig !== sig) {
    if (entry) freeBoard(entry.board);
    const board = newBoard();
    board.suspendUpdate();
    const els = build(board, obj.elements);
    board.unsuspendUpdate();
    entry = { sig, board, els };
    boards.set(obj.id, entry);
  }
  // מעדכנים מיקומים של נקודות חופשיות (וגלישות)
  for (const e of obj.elements) {
    if (e.kind !== 'point' && e.kind !== 'glider') continue;
    const el = entry.els.get(e.id);
    if (el && e.params?.x !== undefined && e.params.y !== undefined) {
      el.setPositionDirectly(JXG.COORDS_BY_USER, [e.params.x, e.params.y]);
    }
  }
  entry.board.update();

  const sol: Solution = new Map();
  const pt = (id: string | undefined) => {
    const s = id ? sol.get(id) : undefined;
    return s && s.t === 'pt' ? s : null;
  };
  for (const e of obj.elements) {
    const el = entry.els.get(e.id);
    let out: Solved = { t: 'none' };
    try {
      switch (e.kind) {
        case 'point':
        case 'glider':
        case 'midpoint':
        case 'intersection':
        case 'foot':
        case 'regularVertex': {
          if (!el) break;
          const x = el.X();
          const y = el.Y();
          if (ok(x, y) && el.isReal !== false) out = { t: 'pt', x, y };
          break;
        }
        case 'segment':
        case 'line':
        case 'ray':
        case 'parallel':
        case 'perpendicular':
        case 'perpBisector':
        case 'angleBisector': {
          if (!el) break;
          const x1 = el.point1.X();
          const y1 = el.point1.Y();
          const x2 = el.point2.X();
          const y2 = el.point2.Y();
          const mode =
            e.kind === 'segment'
              ? 'segment'
              : e.kind === 'ray' || e.kind === 'angleBisector'
                ? 'ray'
                : 'line';
          if (ok(x1, y1, x2, y2) && dist(x1, y1, x2, y2) > 1e-9)
            out = { t: 'ln', x1, y1, x2, y2, mode };
          break;
        }
        case 'circle':
        case 'circleR':
        case 'circle3': {
          if (!el) break;
          const cx = el.center.X();
          const cy = el.center.Y();
          const r = el.Radius();
          if (ok(cx, cy, r) && r > 0) out = { t: 'circ', cx, cy, r };
          break;
        }
        case 'arc': {
          const c = pt(e.parents[0]);
          const a = pt(e.parents[1]);
          const b = pt(e.parents[2]);
          if (c && a && b) {
            out = {
              t: 'arc',
              cx: c.x,
              cy: c.y,
              r: dist(c.x, c.y, a.x, a.y),
              a0: Math.atan2(a.y - c.y, a.x - c.x),
              a1: Math.atan2(b.y - c.y, b.x - c.x),
            };
          }
          break;
        }
        case 'ellipse': {
          if (!el) break;
          const pts: number[] = [];
          const t0 = el.minX();
          const t1 = el.maxX();
          for (let i = 0; i <= 96; i++) {
            const t = t0 + ((t1 - t0) * i) / 96;
            const x = el.X(t);
            const y = el.Y(t);
            if (ok(x, y)) pts.push(x, y);
          }
          if (pts.length > 8) out = { t: 'curve', pts };
          break;
        }
        case 'polygon': {
          const pts: number[] = [];
          for (const id of e.parents) {
            const p = pt(id);
            if (!p) break;
            pts.push(p.x, p.y);
          }
          if (pts.length === e.parents.length * 2 && pts.length >= 6) out = { t: 'poly', pts };
          break;
        }
        case 'angle': {
          const [a, b, c] = e.parents.map((id) => pt(id));
          if (a && b && c)
            out = { t: 'ang', vx: b.x, vy: b.y, ...angleAt(a.x, a.y, b.x, b.y, c.x, c.y) };
          break;
        }
        case 'measure': {
          const target = sol.get(e.parents[0] ?? '');
          const what = e.params?.what ?? 'length';
          if (!target) break;
          if (target.t === 'ln' && what === 'length') {
            out = {
              t: 'meas',
              value: dist(target.x1, target.y1, target.x2, target.y2),
              what,
              x: (target.x1 + target.x2) / 2,
              y: (target.y1 + target.y2) / 2,
            };
          } else if (target.t === 'poly') {
            const n = target.pts.length / 2;
            let cx = 0,
              cy = 0;
            for (let i = 0; i < n; i++) {
              cx += target.pts[i * 2]! / n;
              cy += target.pts[i * 2 + 1]! / n;
            }
            out = {
              t: 'meas',
              value: what === 'perimeter' ? polygonPerimeter(target.pts) : polygonArea(target.pts),
              what,
              x: cx,
              y: cy,
            };
          } else if (target.t === 'circ') {
            const value =
              what === 'area'
                ? Math.PI * target.r ** 2
                : what === 'perimeter'
                  ? 2 * Math.PI * target.r
                  : what === 'diameter'
                    ? 2 * target.r
                    : target.r;
            out = { t: 'meas', value, what, x: target.cx, y: target.cy };
          }
          break;
        }
      }
    } catch {
      out = { t: 'none' };
    }
    sol.set(e.id, out);
  }
  return sol;
}

/** מיקום "גולש" (נקודה על ישר/מעגל) הקרוב לנקודה מבוקשת – לגרירה */
export function forget(objId: string) {
  const e = boards.get(objId);
  if (e) freeBoard(e.board);
  boards.delete(objId);
}
