import { objectHitsPoint } from '../../core/objects/geometry';
import { currentPage } from '../../features/board/boardStore';
import type { PointerSample, ToolContext, ToolHandler } from './types';

// טקסט: לחיצה על הלוח פותחת תיבת כתיבה במקום; לחיצה על טקסט קיים – עורכת אותו.
// תיבת הכתיבה עצמה היא רכיב ממשק (TextEditor), כדי לקבל הקלדה מלאה בעברית.

export class TextTool implements ToolHandler {
  constructor(private ctx: ToolContext) {}

  down(s: PointerSample): void {
    const state = this.ctx.state();
    if (state.textEdit) {
      // לחיצה מחוץ לתיבה פתוחה – רק סוגרת אותה (השמירה נעשית בתיבה עצמה)
      state.endTextEdit();
      return;
    }
    const p = s.point;
    const tol = 4 / this.ctx.view().scale;
    const objects = currentPage(state).objects;
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i]!;
      if (o.type === 'text' && !o.locked && objectHitsPoint(o, p.bx, p.by, tol)) {
        state.startTextEdit({ id: o.id, x: o.transform.x, y: o.transform.y });
        return;
      }
    }
    state.startTextEdit({ id: null, x: p.bx, y: p.by });
  }

  move(): void {}
  up(): void {}
  cancel(): void {}
}
