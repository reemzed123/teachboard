import { visibleObjects } from '../core/document/layers';
import type { QuickActionId } from './actionIds';
import { ACTIONS } from './actions';
import type { AppRuntime } from './runtime';

// קיצורי מקלדת. משתמשים במיקום המקש (e.code) ולא באות,
// כדי שהקיצורים יעבדו גם כשהמקלדת על עברית.
// אפשר למפות אליהם את לחצני ה-Huion בדרייבר של הלוח.

interface Binding {
  code: string;
  ctrl?: boolean;
  shift?: boolean;
  action: QuickActionId | 'selectAll' | 'pagePrev' | 'pageNext';
}

const BINDINGS: Binding[] = [
  { code: 'KeyZ', ctrl: true, shift: true, action: 'edit.redo' },
  { code: 'KeyZ', ctrl: true, action: 'edit.undo' },
  { code: 'KeyY', ctrl: true, action: 'edit.redo' },
  { code: 'KeyA', ctrl: true, action: 'selectAll' },
  { code: 'KeyC', ctrl: true, action: 'edit.copy' },
  { code: 'KeyX', ctrl: true, action: 'edit.cut' },
  // Ctrl+V מטופל באירוע ההדבקה (Workspace): תמונה מהלוח של המערכת, או הדבקה פנימית
  { code: 'KeyD', ctrl: true, action: 'edit.duplicate' },
  { code: 'KeyG', ctrl: true, shift: true, action: 'edit.ungroup' },
  { code: 'KeyG', ctrl: true, action: 'edit.group' },
  { code: 'BracketRight', ctrl: true, shift: true, action: 'edit.bringFront' },
  { code: 'BracketLeft', ctrl: true, shift: true, action: 'edit.sendBack' },
  { code: 'KeyT', action: 'tool.text' },
  { code: 'KeyL', action: 'tool.line' },
  { code: 'KeyA', action: 'tool.arrow' },
  { code: 'KeyG', action: 'tool.geometry' },
  { code: 'KeyK', action: 'tool.laser' },
  { code: 'Equal', ctrl: true, action: 'view.zoomIn' },
  { code: 'NumpadAdd', ctrl: true, action: 'view.zoomIn' },
  { code: 'Minus', ctrl: true, action: 'view.zoomOut' },
  { code: 'NumpadSubtract', ctrl: true, action: 'view.zoomOut' },
  { code: 'Digit0', ctrl: true, action: 'view.zoomFit' },
  { code: 'Numpad0', ctrl: true, action: 'view.zoomFit' },
  { code: 'KeyP', action: 'tool.pen' },
  { code: 'KeyM', action: 'tool.highlighter' },
  { code: 'KeyE', action: 'tool.eraser' },
  { code: 'KeyV', action: 'tool.select' },
  { code: 'KeyH', action: 'tool.hand' },
  { code: 'PageUp', action: 'pagePrev' },
  { code: 'PageDown', action: 'pageNext' },
  { code: 'Delete', action: 'edit.deleteSelection' },
  { code: 'Backspace', action: 'edit.deleteSelection' },
];

const NON_TEXT_INPUTS = new Set([
  'checkbox',
  'radio',
  'range',
  'color',
  'button',
  'submit',
  'reset',
]);

/** האם המשתמש מקליד טקסט כרגע (אז קיצורים לא יופעלו). */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  // עורך הנוסחאות (MathLive)
  if (el.tagName === 'MATH-FIELD') return true;
  return el.tagName === 'INPUT' && !NON_TEXT_INPUTS.has((el as HTMLInputElement).type);
}

/** מחזיר true אם המקש טופל. */
export function handleShortcut(e: KeyboardEvent, rt: AppRuntime): boolean {
  if (isTyping(e.target) || e.altKey) return false;
  const ctrl = e.ctrlKey || e.metaKey;
  const binding = BINDINGS.find(
    (b) =>
      b.code === e.code && !!b.ctrl === ctrl && (b.shift === undefined || b.shift === e.shiftKey),
  );
  if (!binding) return false;
  // מקש בודד (בלי Ctrl) לא יופעל כשיש Shift, כדי לא להתנגש בכתיבה עתידית.
  if (!binding.ctrl && e.shiftKey) return false;
  e.preventDefault();
  if (binding.action === 'pagePrev' || binding.action === 'pageNext') {
    const s = rt.board.getState();
    const i = s.doc.pages.findIndex((p) => p.id === s.pageId);
    const target = s.doc.pages[i + (binding.action === 'pageNext' ? 1 : -1)];
    if (target) s.goToPage(target.id);
    return true;
  }
  if (binding.action === 'selectAll') {
    const s = rt.board.getState();
    s.setTool('select');
    const page = s.doc.pages.find((p) => p.id === s.pageId);
    s.setSelection(
      page
        ? visibleObjects(page)
            .filter((o) => !o.locked)
            .map((o) => o.id)
        : [],
    );
    return true;
  }
  const action = ACTIONS[binding.action];
  if (action.isEnabled && !action.isEnabled(rt)) return true;
  action.run(rt);
  return true;
}
