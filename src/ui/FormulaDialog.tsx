import { useEffect, useRef, useState } from 'react';
import { newId } from '../core/document/ids';
import { IDENTITY_TRANSFORM, type MathObject } from '../core/document/types';
import { useBoard, useRuntime } from '../app/StoreContext';
import { currentPage } from '../features/board/boardStore';
import { loadMathLive } from '../features/math/mathlive';
import { measureMath } from '../engine/render/mathCache';
import { visibleBoardRect } from '../engine/viewport';
import { t } from '../i18n';
import type { MessageKey } from '../i18n/he';

type MathfieldLike = HTMLElement & {
  value: string;
  executeCommand(cmd: unknown): boolean;
  focus(): void;
};

/** תבניות מוכנות: לחיצה מכניסה את המבנה במקום הסמן */
const TEMPLATES: { key: MessageKey; latex: string; show: string }[] = [
  { key: 'formula.t.frac', latex: '\\frac{#0}{#?}', show: 'a⁄b' },
  { key: 'formula.t.power', latex: '^{#?}', show: 'xⁿ' },
  { key: 'formula.t.sqrt', latex: '\\sqrt{#0}', show: '√x' },
  { key: 'formula.t.root', latex: '\\sqrt[#?]{#0}', show: 'ⁿ√x' },
  { key: 'formula.t.paren', latex: '\\left(#0\\right)', show: '( )' },
  { key: 'formula.t.abs', latex: '\\left|#0\\right|', show: '|x|' },
  { key: 'formula.t.sum', latex: '\\sum_{#?}^{#?}#0', show: 'Σ' },
  { key: 'formula.t.integral', latex: '\\int_{#?}^{#?}#0\\,dx', show: '∫' },
  { key: 'formula.t.limit', latex: '\\lim_{#?\\to#?}#0', show: 'lim' },
  { key: 'formula.t.system', latex: '\\begin{cases}#?\\\\#?\\end{cases}', show: '{ ⁞' },
  { key: 'formula.t.le', latex: '\\le', show: '≤' },
  { key: 'formula.t.ge', latex: '\\ge', show: '≥' },
  { key: 'formula.t.ne', latex: '\\ne', show: '≠' },
  { key: 'formula.t.approx', latex: '\\approx', show: '≈' },
  { key: 'formula.t.pm', latex: '\\pm', show: '±' },
  { key: 'formula.t.pi', latex: '\\pi', show: 'π' },
  { key: 'formula.t.infinity', latex: '\\infty', show: '∞' },
  { key: 'formula.t.degree', latex: '^{\\circ}', show: '°' },
  { key: 'formula.t.alpha', latex: '\\alpha', show: 'α' },
  { key: 'formula.t.angle', latex: '\\angle', show: '∠' },
];

const SIZES = [24, 32, 40, 56, 72];

/** עורך הנוסחאות: יצירה ועריכה של נוסחה על הלוח. */
export function FormulaDialog() {
  const edit = useBoard((s) => s.formulaEdit);
  if (!edit) return null;
  return <Dialog key={edit.id ?? 'new'} id={edit.id} />;
}

function Dialog({ id }: { id: string | null }) {
  const rt = useRuntime();
  const existing = useBoard((s) =>
    id
      ? (currentPage(s).objects.find((o) => o.id === id && o.type === 'math') as
          MathObject | undefined)
      : undefined,
  );
  const penColor = useBoard((s) => s.prefs.pen.color);
  const [ready, setReady] = useState(false);
  const [fontSize, setFontSize] = useState(existing?.fontSize ?? 40);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fieldRef = useRef<MathfieldLike | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal?.();
    let cancelled = false;
    void loadMathLive().then(() => {
      if (cancelled) return;
      setReady(true);
    });
    return () => {
      cancelled = true;
      const kb = (window as unknown as { mathVirtualKeyboard?: { hide(): void } })
        .mathVirtualKeyboard;
      try {
        kb?.hide();
      } catch {
        // אין מקלדת להסתיר
      }
    };
  }, []);

  useEffect(() => {
    const f = fieldRef.current;
    if (!ready || !f) return;
    if (existing) f.value = existing.latex;
    const kb = (window as unknown as { mathVirtualKeyboard?: { container: HTMLElement | null } })
      .mathVirtualKeyboard;
    // המקלדת המתמטית מוצגת בתוך החלון (אחרת היא מוסתרת מאחוריו)
    // (בתוך מסגרת של אתר אחר MathLive לא מרשה לשנות זאת וזורק שגיאה – אז מדלגים)
    if (kb && dialogRef.current && window.top === window.self) {
      try {
        kb.container = dialogRef.current;
      } catch {
        // המקלדת תופיע במקומה הרגיל
      }
    }
    setTimeout(() => f.focus());
  }, [ready, existing]);

  const close = () => rt.board.getState().closeFormula();

  const insert = async () => {
    const latex = fieldRef.current?.value.trim() ?? '';
    const s = rt.board.getState();
    setBusy(true);
    try {
      if (!latex) {
        if (existing)
          s.commit('formula', [{ type: 'remove', pageId: s.pageId, ids: [existing.id] }]);
        close();
        return;
      }
      const size = await measureMath(latex, fontSize);
      if (existing) {
        s.commit('formula', [
          {
            type: 'replace',
            pageId: s.pageId,
            objects: [{ ...existing, latex, fontSize, ...size }],
          },
        ]);
      } else {
        // במרכז האזור הנראה
        const host = document.querySelector('[data-testid=board]') as HTMLElement | null;
        const area = visibleBoardRect(s.view, host?.clientWidth ?? 800, host?.clientHeight ?? 600);
        const obj: MathObject = {
          id: newId(),
          type: 'math',
          transform: {
            ...IDENTITY_TRANSFORM,
            x: area.x + area.width / 2 - size.width / 2,
            y: area.y + area.height / 2 - size.height / 2,
          },
          latex,
          color: penColor,
          fontSize,
          ...size,
        };
        s.commit('formula', [{ type: 'add', pageId: s.pageId, objects: [obj] }]);
        s.setTool('select');
        s.setSelection([obj.id]);
      }
      close();
    } finally {
      setBusy(false);
    }
  };

  const toggleKeyboard = () => {
    const kb = (
      window as unknown as {
        mathVirtualKeyboard?: { visible: boolean; show(): void; hide(): void };
      }
    ).mathVirtualKeyboard;
    if (!kb) return;
    try {
      if (kb.visible) kb.hide();
      else kb.show();
    } catch {
      // בתוך מסגרת המקלדת מנוהלת על ידי החלון החיצוני
    }
    fieldRef.current?.focus();
  };

  return (
    <dialog
      ref={dialogRef}
      className="tb-dialog tb-formula-dialog"
      aria-labelledby="tb-formula-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <h2 id="tb-formula-title">{existing ? t('formula.editTitle') : t('formula.newTitle')}</h2>
      <div className="tb-formula-field" dir="ltr">
        {ready ? (
          <math-field
            ref={(el) => {
              fieldRef.current = el as MathfieldLike | null;
            }}
            math-virtual-keyboard-policy="manual"
            aria-label={t('formula.field')}
            data-testid="formula-field"
            style={{ fontSize: Math.min(fontSize, 40) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void insert();
            }}
          />
        ) : (
          <p className="tb-help">{t('formula.loading')}</p>
        )}
      </div>
      <div
        className="tb-formula-templates"
        role="group"
        aria-label={t('formula.templates')}
        dir="ltr"
      >
        {TEMPLATES.map((tp) => (
          <button
            key={tp.key}
            type="button"
            className="tb-template-btn"
            title={t(tp.key)}
            aria-label={t(tp.key)}
            disabled={!ready}
            onClick={() => {
              fieldRef.current?.executeCommand([
                'insert',
                tp.latex,
                { selectionMode: 'placeholder' },
              ]);
              fieldRef.current?.focus();
            }}
          >
            {tp.show}
          </button>
        ))}
      </div>
      <div className="tb-formula-options">
        <label className="tb-select-inline">
          {t('formula.size')}
          <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}>
            {SIZES.map((sz) => (
              <option key={sz} value={sz}>
                {sz}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="tb-btn" onClick={toggleKeyboard} disabled={!ready}>
          {t('formula.keyboard')}
        </button>
      </div>
      <p className="tb-help">{t('formula.help')}</p>
      <div className="tb-dialog-actions">
        <button
          type="button"
          className="tb-btn tb-btn-primary"
          disabled={!ready || busy}
          onClick={() => void insert()}
        >
          {existing ? t('formula.update') : t('formula.insert')}
        </button>
        <button type="button" className="tb-btn" onClick={close}>
          {t('common.cancel')}
        </button>
      </div>
    </dialog>
  );
}
