import Konva from 'konva';
import type { Rect } from '../../core/geometry/rect';
import { rectsIntersect } from '../../core/geometry/rect';
import type { InkObject, ObjectId } from '../../core/document/types';
import { inkBounds } from '../../core/ink/ink';
import { outlinePath } from './inkOutline';

interface Entry {
  obj: InkObject;
  node: Konva.Shape;
  bounds: Rect;
}

// שכבת הקווים הגמורים. מסנכרנת את רשימת האובייקטים במסמך לצורות ב-Konva,
// ומציירת רק את מה שצריך:
//  - קו חדש בסוף הרשימה → מצויר לבד, בלי לצייר מחדש את כל הלוח.
//  - קווים מחוץ למסך → מוסתרים (לא נצבעים).

export class InkLayer {
  readonly layer = new Konva.Layer({ listening: false });
  private entries = new Map<ObjectId, Entry>();
  private order: ObjectId[] = [];
  private paths = new WeakMap<InkObject, Path2D>();
  private viewRect: Rect | null = null;
  /** אובייקטים שמוסתרים זמנית (למשל בזמן מחיקה) */
  private hidden = new Set<ObjectId>();

  get count(): number {
    return this.order.length;
  }

  private pathFor(obj: InkObject): Path2D {
    let p = this.paths.get(obj);
    if (!p) {
      p = outlinePath(obj.points, obj.style.kind, obj.style.width, obj.pressure, true);
      this.paths.set(obj, p);
    }
    return p;
  }

  private createNode(obj: InkObject): Konva.Shape {
    const node = new Konva.Shape({
      listening: false,
      perfectDrawEnabled: false,
      sceneFunc: (ctx) => {
        const current = this.entries.get(obj.id)?.obj ?? obj;
        const native = ctx._context;
        native.fillStyle = current.style.color;
        native.fill(this.pathFor(current));
      },
    });
    this.applyAttrs(node, obj);
    return node;
  }

  private applyAttrs(node: Konva.Shape, obj: InkObject) {
    node.setAttrs({
      x: obj.transform.x,
      y: obj.transform.y,
      opacity: obj.style.opacity,
      globalCompositeOperation: obj.style.kind === 'highlighter' ? 'multiply' : 'source-over',
    });
  }

  private isVisible(id: ObjectId, bounds: Rect): boolean {
    if (this.hidden.has(id)) return false;
    return this.viewRect ? rectsIntersect(bounds, this.viewRect) : true;
  }

  /** מסנכרן לרשימת האובייקטים של העמוד. */
  sync(objects: readonly InkObject[]): void {
    const prevOrder = this.order;
    const nextIds = new Set<ObjectId>();
    let changedExisting = false;
    const appended: Entry[] = [];

    for (const obj of objects) {
      nextIds.add(obj.id);
      const entry = this.entries.get(obj.id);
      if (!entry) {
        const node = this.createNode(obj);
        const e: Entry = { obj, node, bounds: inkBounds(obj) };
        this.entries.set(obj.id, e);
        this.layer.add(node);
        appended.push(e);
      } else if (entry.obj !== obj) {
        entry.obj = obj;
        entry.bounds = inkBounds(obj);
        this.applyAttrs(entry.node, obj);
        changedExisting = true;
      }
    }

    for (const id of prevOrder) {
      if (!nextIds.has(id)) {
        this.entries.get(id)?.node.destroy();
        this.entries.delete(id);
        changedExisting = true;
      }
    }

    const nextOrder = objects.map((o) => o.id);
    // האם הסדר של האובייקטים הקיימים נשמר, והחדשים רק נוספו בסוף?
    const appendOnly =
      !changedExisting &&
      prevOrder.length + appended.length === nextOrder.length &&
      prevOrder.every((id, i) => nextOrder[i] === id);

    if (!appendOnly) {
      nextOrder.forEach((id, i) => this.entries.get(id)?.node.zIndex(i));
    }
    this.order = nextOrder;

    for (const e of appended) e.node.visible(this.isVisible(e.obj.id, e.bounds));

    if (appendOnly) {
      // ציור מהיר: רק הקווים החדשים, מעל מה שכבר מצויר.
      for (const e of appended) if (e.node.visible()) e.node.draw();
    } else {
      this.refreshVisibility();
      this.layer.batchDraw();
    }
  }

  /** מעדכן את האזור הנראה ומסתיר קווים שמחוצה לו. */
  setViewRect(rect: Rect): void {
    this.viewRect = rect;
    this.refreshVisibility();
  }

  private refreshVisibility(): void {
    for (const [id, e] of this.entries) e.node.visible(this.isVisible(id, e.bounds));
  }

  setHidden(ids: Iterable<ObjectId>): void {
    this.hidden = new Set(ids);
    this.refreshVisibility();
    this.layer.batchDraw();
  }

  /** הזזה זמנית של אובייקטים (בזמן גרירה), בלי לשנות את המסמך. */
  previewOffset(ids: readonly ObjectId[], dx: number, dy: number): void {
    for (const id of ids) {
      const e = this.entries.get(id);
      if (e) e.node.position({ x: e.obj.transform.x + dx, y: e.obj.transform.y + dy });
    }
    this.layer.batchDraw();
  }

  getObject(id: ObjectId): InkObject | undefined {
    return this.entries.get(id)?.obj;
  }

  boundsOf(id: ObjectId): Rect | undefined {
    return this.entries.get(id)?.bounds;
  }

  destroy(): void {
    this.layer.destroy();
    this.entries.clear();
  }
}
