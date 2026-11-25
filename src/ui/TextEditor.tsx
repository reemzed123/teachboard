import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { newId } from '../core/document/ids';
import { IDENTITY_TRANSFORM, type TextObject } from '../core/document/types';
import { useBoard, useRuntime } from '../app/StoreContext';
import { currentPage } from '../features/board/boardStore';
import {
  detectDirection,
  measureText,
  TEXT_FONT_FAMILY,
  TEXT_LINE_HEIGHT,
} from '../engine/render/drawObject';
import { t } from '../i18n';

/**
 * תיבת כתיבה מעל הלוח, במקום שבו הטקסט יופיע.
 * כתיבה רגילה בעברית/אנגלית (כולל כיוון אוטומטי), Enter = שורה חדשה,
 * Ctrl+Enter / Escape / לחיצה מחוץ לתיבה = סיום ושמירה.
 */
export function TextEditor() {
  const edit = useBoard((s) => s.textEdit);
  if (!edit) return null;
  return <Editor key={`${edit.id ?? 'new'}:${edit.x}:${edit.y}`} />;
}

function Editor() {
  const rt = useRuntime();
  const edit = useBoard((s) => s.textEdit)!;
  const view = useBoard((s) => s.view);
  const prefs = useBoard((s) => s.prefs);
  const existing = useBoard((s) =>
    edit.id
      ? (currentPage(s).objects.find((o) => o.id === edit.id && o.type === 'text') as
          TextObject | undefined)
      : undefined,
  );
  const [text, setText] = useState(existing?.text ?? '');
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  const fontSize = existing?.fontSize ?? prefs.text.fontSize;
  const bold = existing?.bold ?? prefs.text.bold;
  const color = existing?.color ?? prefs.pen.color;
  const transform = existing?.transform ?? { ...IDENTITY_TRANSFORM, x: edit.x, y: edit.y };
  const dir = text.trim() ? detectDirection(text) : (existing?.dir ?? 'rtl');

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    const s = rt.board.getState();
    const value = text.replace(/\s+$/, '');
    if (!value) {
      // טקסט שנמחק כולו – מסירים את האובייקט
      if (existing) s.commit('text', [{ type: 'remove', pageId: s.pageId, ids: [existing.id] }]);
    } else {
      const size = measureText(value, fontSize, bold);
      const obj: TextObject = {
        ...(existing ?? {}),
        id: existing?.id ?? newId(),
        type: 'text',
        transform,
        text: value,
        fontSize,
        bold: bold || undefined,
        color,
        dir: detectDirection(value),
        width: size.width,
        height: size.height,
      };
      if (!obj.bold) delete obj.bold;
      if (!existing) s.commit('text', [{ type: 'add', pageId: s.pageId, objects: [obj] }]);
      else if (existing.text !== obj.text || existing.dir !== obj.dir) {
        s.commit('text', [{ type: 'replace', pageId: s.pageId, objects: [obj] }]);
      }
    }
    s.endTextEdit();
  };

  // אם העריכה הסתיימה מבחוץ (לחיצה על הלוח, מעבר כלי) – שומרים את הטקסט העדכני.
  // (קודם נשמרה כאן גרסה ישנה של הפונקציה, עם טקסט ריק – והטקסט "נעלם".)
  const latestCommit = useRef(commit);
  useLayoutEffect(() => {
    latestCommit.current = commit;
  });
  useEffect(() => () => latestCommit.current(), []);

  const size = measureText(text || ' ', fontSize, bold);
  const px = fontSize * transform.scale * view.scale;
  const left = transform.x * view.scale + view.x;
  const top = transform.y * view.scale + view.y;
  const width = Math.max(size.width, fontSize * 2) * transform.scale * view.scale + 8;

  return (
    <textarea
      ref={ref}
      className="tb-text-editor"
      aria-label={t('text.editor')}
      dir={dir}
      value={text}
      spellCheck={false}
      style={{
        left: dir === 'rtl' ? left - width : left,
        top,
        width,
        height: size.height * transform.scale * view.scale + 4,
        fontSize: px,
        lineHeight: TEXT_LINE_HEIGHT,
        fontFamily: TEXT_FONT_FAMILY,
        fontWeight: bold ? 700 : 400,
        color,
        transform: `rotate(${transform.rotation}deg)`,
        transformOrigin: dir === 'rtl' ? 'top right' : 'top left',
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          commit();
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}
