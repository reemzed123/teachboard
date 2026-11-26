import Konva from 'konva';
import type { Rect } from '../../core/geometry/rect';
import { rectsIntersect } from '../../core/geometry/rect';
import type { BoardObject, ObjectId } from '../../core/document/types';
import { objectBounds } from '../../core/objects/geometry';
import { drawObjectLocal, objectBlend, objectOpacity } from './drawObject';

interface Entry {
  obj: BoardObject;
  /** גרסה זמנית בזמן גרירה (למשל גרף שמסגרתו גדלה) – מצוירת במקום obj */
  preview?: BoardObject;
  node: Konva.Shape;
  bounds: Rect;
}

// שכבת האובייקטים הגמורים. מסנכרנת את רשימת האובייקטים במסמך לצורות ב-Konva,
// ומציירת רק את מה שצריך:
//  - אובייקט חדש בסוף הרשימה → מצויר לבד, בלי לצייר מחדש את כל הלוח.
//  - אובייקטים מחוץ למסך → מוסתרים (לא נצבעים).

export class ObjectLayer {
  readonly layer = new Konva.Layer({ listening: false });
  private entries = new Map<ObjectId, Entry>();
  private order: ObjectId[] = [];
  private viewRect: Rect | null = null;
  /** אובייקטים שמוסתרים זמנית (למשל בזמן מחיקה או עריכת טקסט) */
  private hidden = new Set<ObjectId>();

  get count(): number {
    return this.order.length;
  }

  private createNode(obj: BoardObject): Konva.Shape {
    const node = new Konva.Shape({
      listening: false,
      perfectDrawEnabled: false,
      sceneFunc: (ctx) => {
        const e = this.entries.get(obj.id);
        const current = e?.preview ?? e?.obj ?? obj;
        drawObjectLocal(ctx._context, current);
      },
    });
    this.applyAttrs(node, obj);
    return node;
  }

  private applyAttrs(node: Konva.Shape, obj: BoardObject) {
    node.setAttrs({
      x: obj.transform.x,
      y: obj.transform.y,
      rotation: obj.transform.rotation,
      scaleX: obj.transform.scale,
      scaleY: obj.transform.scale,
      opacity: objectOpacity(obj),
      globalCompositeOperation: objectBlend(obj),
    });
  }

  private isVisible(id: ObjectId, bounds: Rect): boolean {
    if (this.hidden.has(id)) return false;
    // בנייה גיאומטרית יכולה לכלול ישרים "אינסופיים" – תמיד מציירים אותה
    if (this.entries.get(id)?.obj.type === 'geometry') return true;
    return this.viewRect ? rectsIntersect(bounds, this.viewRect) : true;
  }

  /** מסנכרן לרשימת האובייקטים של העמוד. */
  sync(objects: readonly BoardObject[]): void {
    const prevOrder = this.order;
    const nextIds = new Set<ObjectId>();
    let changedExisting = false;
    const appended: Entry[] = [];

    for (const obj of objects) {
      nextIds.add(obj.id);
      const entry = this.entries.get(obj.id);
      if (!entry) {
        const node = this.createNode(obj);
        const e: Entry = { obj, node, bounds: objectBounds(obj) };
        this.entries.set(obj.id, e);
        this.layer.add(node);
        appended.push(e);
      } else if (entry.obj !== obj) {
        entry.obj = obj;
        entry.preview = undefined;
        entry.bounds = objectBounds(obj);
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
      // ציור מהיר: רק האובייקטים החדשים, מעל מה שכבר מצויר.
      for (const e of appended) if (e.node.visible()) e.node.draw();
    } else {
      this.refreshVisibility();
      this.layer.batchDraw();
    }
  }

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

  /** תצוגה זמנית של שינוי מיקום/סיבוב/גודל (בזמן גרירה), בלי לשנות את המסמך. */
  previewTransforms(objects: readonly BoardObject[]): void {
    for (const o of objects) {
      const e = this.entries.get(o.id);
      if (!e) continue;
      e.preview = o;
      this.applyAttrs(e.node, o);
    }
    this.layer.batchDraw();
  }

  /** מבטל תצוגה זמנית ומחזיר את המצב השמור. */
  resetPreview(ids: readonly ObjectId[]): void {
    for (const id of ids) {
      const e = this.entries.get(id);
      if (!e) continue;
      e.preview = undefined;
      this.applyAttrs(e.node, e.obj);
    }
    this.layer.batchDraw();
  }

  getObject(id: ObjectId): BoardObject | undefined {
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
