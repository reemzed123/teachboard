import { Eraser, Sigma, Undo2 } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useBoard, useRuntime } from '../app/StoreContext';
import { t } from '../i18n';
import type { MessageKey } from '../i18n/he';

const RADIUS = 62;

interface Item {
  id: string;
  label: MessageKey;
  icon: ReactNode;
  run(): void;
}

/** תפריט מהיר עגול במקום העט (כפתור הצד של העט / קליק ימני): צבעים, מחק, ביטול, נוסחה */
export function QuickRadialMenu() {
  const rt = useRuntime();
  const pos = useBoard((s) => s.quickMenu);
  const close = () => rt.board.getState().setQuickMenu(null);

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.tb-radial')) close();
    };
    window.addEventListener('keydown', onKey);
    // לחיצה מחוץ לתפריט סוגרת (נרשם אחרי הלחיצה שפתחה אותו)
    const id = setTimeout(() => window.addEventListener('pointerdown', onDown, true), 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close יציב (פונקציה על החנות)
  }, [pos]);

  if (!pos) return null;
  const s = rt.board.getState();
  const pen = (color: string) => () => {
    s.updatePrefs((p) => ({ ...p, pen: { ...p.pen, color } }));
    s.setTool('pen');
  };
  const swatch = (c: string) => <span className="tb-radial-swatch" style={{ background: c }} />;
  const items: Item[] = [
    { id: 'black', label: 'radial.black', icon: swatch('#1c2430'), run: pen('#1c2430') },
    { id: 'red', label: 'radial.red', icon: swatch('#dc2626'), run: pen('#dc2626') },
    { id: 'blue', label: 'radial.blue', icon: swatch('#2563eb'), run: pen('#2563eb') },
    {
      id: 'eraser',
      label: 'tool.eraser',
      icon: <Eraser size={20} />,
      run: () => s.setTool('eraser'),
    },
    { id: 'undo', label: 'action.edit.undo', icon: <Undo2 size={20} />, run: () => s.undo() },
    {
      id: 'formula',
      label: 'math.newFormula',
      icon: <Sigma size={20} />,
      run: () => s.openFormula(null),
    },
  ];
  return (
    <div
      className="tb-radial"
      role="menu"
      aria-label={t('radial.title')}
      data-testid="quick-menu"
      style={{ left: Math.max(80, pos.x), top: Math.max(80, pos.y) }}
    >
      {items.map((item, i) => {
        const a = -Math.PI / 2 + (i / items.length) * Math.PI * 2;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className="tb-radial-item"
            data-quick={item.id}
            title={t(item.label)}
            aria-label={t(item.label)}
            style={{ transform: `translate(${Math.cos(a) * RADIUS}px, ${Math.sin(a) * RADIUS}px)` }}
            onClick={() => {
              item.run();
              close();
            }}
          >
            {item.icon}
          </button>
        );
      })}
      <button
        type="button"
        className="tb-radial-center"
        aria-label={t('radial.close')}
        title={t('radial.close')}
        onClick={close}
      />
    </div>
  );
}
