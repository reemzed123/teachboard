import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpRight,
  BringToFront,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Group,
  Lock,
  LockOpen,
  Minus,
  Scissors,
  SendToBack,
  Type,
  Ungroup,
  Expand,
  Eraser,
  Focus,
  Hand,
  Highlighter,
  Maximize,
  MousePointer2,
  PanelRight,
  PenLine,
  Redo2,
  SunMoon,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { MessageKey } from '../i18n/he';
import type { ToolId } from '../features/board/toolPrefs';
import { currentPage, type BoardState } from '../features/board/boardStore';
import type { QuickActionId } from './actionIds';
import type { AppRuntime } from './runtime';
import { resolveTheme } from './theme';

export interface ActionDef {
  id: QuickActionId;
  labelKey: MessageKey;
  icon: LucideIcon;
  /** קיצור מקלדת לתצוגה (למשל בהסבר בריחוף) */
  shortcut?: string;
  run(rt: AppRuntime): void;
  /** מצב "פעיל" (לחצן לחוץ), אם רלוונטי. */
  isActive?(rt: AppRuntime): boolean;
  /** האם אפשר להפעיל כרגע (למשל אין מה לבטל) */
  isEnabled?(rt: AppRuntime): boolean;
}

function toolAction(
  id: QuickActionId,
  tool: ToolId,
  labelKey: MessageKey,
  icon: LucideIcon,
  shortcut: string,
): ActionDef {
  return {
    id,
    labelKey,
    icon,
    shortcut,
    run: (rt) => rt.board.getState().setTool(tool),
    isActive: (rt) => rt.board.getState().tool === tool,
  };
}

/** פעולה שפועלת על הבחירה (זמינה רק כשיש בחירה) */
function selectionAction(
  id: QuickActionId,
  icon: LucideIcon,
  shortcut: string | undefined,
  fn: (s: BoardState) => void,
): ActionDef {
  return {
    id,
    labelKey: `action.${id}` as MessageKey,
    icon,
    shortcut,
    run: (rt) => fn(rt.board.getState()),
    isEnabled: (rt) => rt.board.getState().selection.length > 0,
  };
}

export const ACTIONS: Record<QuickActionId, ActionDef> = {
  'tool.pen': toolAction('tool.pen', 'pen', 'tool.pen', PenLine, 'P'),
  'tool.highlighter': toolAction(
    'tool.highlighter',
    'highlighter',
    'tool.highlighter',
    Highlighter,
    'M',
  ),
  'tool.eraser': toolAction('tool.eraser', 'eraser', 'tool.eraser', Eraser, 'E'),
  'tool.select': toolAction('tool.select', 'select', 'tool.select', MousePointer2, 'V'),
  'tool.hand': toolAction('tool.hand', 'hand', 'tool.hand', Hand, 'H'),
  'tool.text': toolAction('tool.text', 'text', 'tool.text', Type, 'T'),
  'tool.line': toolAction('tool.line', 'line', 'tool.line', Minus, 'L'),
  'tool.arrow': toolAction('tool.arrow', 'arrow', 'tool.arrow', ArrowUpRight, 'A'),
  'edit.duplicate': selectionAction('edit.duplicate', CopyPlus, 'Ctrl+D', (s) =>
    s.duplicateSelection(),
  ),
  'edit.copy': selectionAction('edit.copy', Copy, 'Ctrl+C', (s) => s.copySelection()),
  'edit.cut': selectionAction('edit.cut', Scissors, 'Ctrl+X', (s) => s.cutSelection()),
  'edit.paste': {
    id: 'edit.paste',
    labelKey: 'action.edit.paste',
    icon: ClipboardPaste,
    shortcut: 'Ctrl+V',
    run: (rt) => rt.board.getState().paste(),
    isEnabled: (rt) => !!rt.board.getState().clipboard?.length,
  },
  'edit.bringFront': selectionAction('edit.bringFront', BringToFront, 'Ctrl+Shift+]', (s) =>
    s.reorderSelection('front'),
  ),
  'edit.sendBack': selectionAction('edit.sendBack', SendToBack, 'Ctrl+Shift+[', (s) =>
    s.reorderSelection('back'),
  ),
  'edit.group': {
    id: 'edit.group',
    labelKey: 'action.edit.group',
    icon: Group,
    shortcut: 'Ctrl+G',
    run: (rt) => rt.board.getState().groupSelection(),
    isEnabled: (rt) => rt.board.getState().selection.length > 1,
  },
  'edit.ungroup': {
    id: 'edit.ungroup',
    labelKey: 'action.edit.ungroup',
    icon: Ungroup,
    shortcut: 'Ctrl+Shift+G',
    run: (rt) => rt.board.getState().ungroupSelection(),
    isEnabled: (rt) => {
      const s = rt.board.getState();
      const ids = new Set(s.selection);
      return currentPage(s).objects.some((o) => ids.has(o.id) && o.groupId);
    },
  },
  'edit.lock': selectionAction('edit.lock', Lock, undefined, (s) => s.lockSelection()),
  'edit.unlockAll': {
    id: 'edit.unlockAll',
    labelKey: 'action.edit.unlockAll',
    icon: LockOpen,
    run: (rt) => rt.board.getState().unlockAll(),
    isEnabled: (rt) => currentPage(rt.board.getState()).objects.some((o) => o.locked),
  },
  'edit.undo': {
    id: 'edit.undo',
    labelKey: 'action.edit.undo',
    icon: Undo2,
    shortcut: 'Ctrl+Z',
    run: (rt) => rt.board.getState().undo(),
    isEnabled: (rt) => rt.board.getState().history.past.length > 0,
  },
  'edit.redo': {
    id: 'edit.redo',
    labelKey: 'action.edit.redo',
    icon: Redo2,
    shortcut: 'Ctrl+Y',
    run: (rt) => rt.board.getState().redo(),
    isEnabled: (rt) => rt.board.getState().history.future.length > 0,
  },
  'edit.deleteSelection': {
    id: 'edit.deleteSelection',
    labelKey: 'action.edit.deleteSelection',
    icon: Trash2,
    shortcut: 'Delete',
    run: (rt) => {
      const s = rt.board.getState();
      if (s.selection.length === 0) return;
      s.commit('delete', [{ type: 'remove', pageId: s.pageId, ids: s.selection }]);
    },
    isEnabled: (rt) => rt.board.getState().selection.length > 0,
  },
  'view.zoomIn': {
    id: 'view.zoomIn',
    labelKey: 'action.view.zoomIn',
    icon: ZoomIn,
    shortcut: 'Ctrl+=',
    run: (rt) => rt.engine?.zoomBy(1.25),
  },
  'view.zoomOut': {
    id: 'view.zoomOut',
    labelKey: 'action.view.zoomOut',
    icon: ZoomOut,
    shortcut: 'Ctrl+-',
    run: (rt) => rt.engine?.zoomBy(0.8),
  },
  'view.zoomFit': {
    id: 'view.zoomFit',
    labelKey: 'action.view.zoomFit',
    icon: Maximize,
    shortcut: 'Ctrl+0',
    run: (rt) => rt.engine?.fitContent(),
  },
  'view.toggleTheme': {
    id: 'view.toggleTheme',
    labelKey: 'action.view.toggleTheme',
    icon: SunMoon,
    run(rt) {
      const s = rt.app.getState();
      s.setTheme(resolveTheme(s.settings.theme) === 'dark' ? 'light' : 'dark');
    },
  },
  'view.fullscreen': {
    id: 'view.fullscreen',
    labelKey: 'action.view.fullscreen',
    icon: Expand,
    shortcut: 'F11',
    run() {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      } else {
        void document.documentElement.requestFullscreen?.().catch(() => undefined);
      }
    },
  },
  'view.focusMode': {
    id: 'view.focusMode',
    labelKey: 'action.view.focusMode',
    icon: Focus,
    run: (rt) => rt.app.getState().setFocusMode(true),
  },
  'view.toggleCategoryBar': {
    id: 'view.toggleCategoryBar',
    labelKey: 'action.view.toggleCategoryBar',
    icon: PanelRight,
    run: (rt) => rt.app.getState().toggleCategoryBar(),
    isActive: (rt) => rt.app.getState().categoryBarVisible,
  },
};

/** הטקסט להסבר בריחוף: שם הפעולה + קיצור המקלדת. */
export function actionTooltip(label: string, shortcut?: string): string {
  return shortcut ? `${label} (${shortcut})` : label;
}
