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
  action: QuickActionId | 'selectAll';
}

const BINDINGS: Binding[] = [
  { code: 'KeyZ', ctrl: true, shift: true, action: 'edit.redo' },
  { code: 'KeyZ', ctrl: true, action: 'edit.undo' },
  { code: 'KeyY', ctrl: true, action: 'edit.redo' },
  { code: 'KeyA', ctrl: true, action: 'selectAll' },
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
  if (binding.action === 'selectAll') {
    const s = rt.board.getState();
    s.setTool('select');
    const page = s.doc.pages.find((p) => p.id === s.pageId);
    s.setSelection(page ? page.objects.filter((o) => !o.locked).map((o) => o.id) : []);
    return true;
  }
  const action = ACTIONS[binding.action];
  if (action.isEnabled && !action.isEnabled(rt)) return true;
  action.run(rt);
  return true;
}
