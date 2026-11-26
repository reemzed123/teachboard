import { ArrowDownToLine, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useBoard, useRuntime } from '../app/StoreContext';
import { nextLayerName } from '../core/document/layers';
import { currentPage } from '../features/board/boardStore';
import { t } from '../i18n';

/** שכבות העמוד: בחירת שכבה פעילה, הסתרה/הצגה, שינוי שם, מחיקה והעברת נבחרים. */
export function LayersSection() {
  const rt = useRuntime();
  const page = useBoard((s) => currentPage(s));
  const active = useBoard((s) => s.activeLayer);
  const hasSelection = useBoard((s) => s.selection.length > 0);
  const st = rt.board.getState();
  const layers = page.layers ?? [];

  const rows = [
    { id: null as string | null, name: t('layers.main'), hidden: false },
    ...layers.map((l) => ({ id: l.id as string | null, name: l.name, hidden: !!l.hidden })),
  ];

  return (
    <section className="tb-field" aria-label={t('layers.title')} data-testid="layers">
      <h3 className="tb-section-title">{t('layers.title')}</h3>
      <ul className="tb-layer-list">
        {[...rows].reverse().map((row) => (
          <li
            key={row.id ?? 'main'}
            className="tb-layer-row"
            data-layer={row.id ?? 'main'}
            data-active={(active ?? null) === row.id || undefined}
          >
            <input
              type="radio"
              name="tb-active-layer"
              aria-label={t('layers.active', { name: row.name })}
              checked={(active ?? null) === row.id}
              disabled={row.hidden}
              onChange={() => st.setActiveLayer(row.id)}
            />
            {row.id ? (
              <input
                key={`${row.id}-${row.name}`}
                className="tb-input tb-layer-name"
                aria-label={t('layers.rename')}
                defaultValue={row.name}
                maxLength={40}
                onBlur={(e) =>
                  row.id &&
                  e.target.value.trim() !== row.name &&
                  st.renameLayer(row.id, e.target.value)
                }
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
            ) : (
              <span className="tb-layer-name">{row.name}</span>
            )}
            {hasSelection && (
              <button
                type="button"
                className="tb-icon-mini"
                title={t('layers.moveHere')}
                aria-label={t('layers.moveHere')}
                data-action="layer.moveHere"
                onClick={() => st.moveSelectionToLayer(row.id)}
              >
                <ArrowDownToLine size={16} aria-hidden="true" />
              </button>
            )}
            {row.id && (
              <>
                <button
                  type="button"
                  className="tb-icon-mini"
                  aria-pressed={!row.hidden}
                  title={
                    row.hidden
                      ? t('layers.show', { name: row.name })
                      : t('layers.hide', { name: row.name })
                  }
                  aria-label={
                    row.hidden
                      ? t('layers.show', { name: row.name })
                      : t('layers.hide', { name: row.name })
                  }
                  data-action="layer.toggle"
                  onClick={() => st.setLayerHidden(row.id!, !row.hidden)}
                >
                  {row.hidden ? (
                    <EyeOff size={16} aria-hidden="true" />
                  ) : (
                    <Eye size={16} aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  className="tb-icon-mini"
                  title={t('layers.delete')}
                  aria-label={t('layers.delete')}
                  onClick={() => st.deleteLayer(row.id!)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="tb-btn tb-btn-tool"
        onClick={() => st.addLayer(nextLayerName(page, (n) => t('layers.defaultName', { n })))}
      >
        <Plus size={18} aria-hidden="true" />
        {t('layers.add')}
      </button>
      <p className="tb-help">{t('layers.help')}</p>
    </section>
  );
}
