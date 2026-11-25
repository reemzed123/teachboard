import { useId, useState } from 'react';
import type { QuickActionId } from '../app/actionIds';
import { useBoard, useRuntime } from '../app/StoreContext';
import { currentPage } from '../features/board/boardStore';
import {
  ERASER_SIZES,
  HIGHLIGHTER_COLORS,
  HIGHLIGHTER_WIDTHS,
  PEN_COLORS,
  PEN_WIDTHS,
  TEXT_SIZES,
  MAX_FAVORITES,
  WIDTH_LIMITS,
  type EraserMode,
} from '../features/board/toolPrefs';
import { t } from '../i18n';
import type { MessageKey } from '../i18n/he';
import { ACTIONS, actionTooltip } from '../app/actions';
import { SMOOTHING_LEVELS } from '../core/ink/smoothing';
import { ConfirmDialog } from './ConfirmDialog';
import { ActionButton } from './ActionButton';
import { IconButton } from './IconButton';
import { Plus, X } from 'lucide-react';
import type { LineDash } from '../core/document/types';
import { SidePanel } from './SidePanel';

const TOOL_ACTIONS: QuickActionId[] = [
  'tool.pen',
  'tool.highlighter',
  'tool.eraser',
  'tool.select',
  'tool.text',
  'tool.line',
  'tool.arrow',
  'tool.hand',
];

const LINE_DASHES: LineDash[] = ['solid', 'dashed', 'dotted'];

export function DrawingPanel() {
  const rt = useRuntime();
  const tool = useBoard((s) => s.tool);
  const prefs = useBoard((s) => s.prefs);
  const updatePrefs = useBoard((s) => s.updatePrefs);
  const selection = useBoard((s) => s.selection);
  const pressureDetected = useBoard((s) => s.pressureDetected);
  const penDetected = useBoard((s) => s.penDetected);
  const isEmpty = useBoard((s) => currentPage(s).objects.length === 0);
  const [confirmClear, setConfirmClear] = useState(false);
  const id = useId();

  return (
    <SidePanel title={t('category.drawing')}>
      <div className="tb-tool-grid" role="radiogroup" aria-label={t('drawing.tools')}>
        {TOOL_ACTIONS.map((aid) => {
          const a = ACTIONS[aid];
          const Icon = a.icon;
          const active = a.isActive?.(rt) ?? false;
          return (
            <button
              key={aid}
              type="button"
              role="radio"
              aria-checked={active}
              className="tb-tool-btn"
              title={actionTooltip(t(a.labelKey), a.shortcut)}
              onClick={() => a.run(rt)}
              data-action={aid}
            >
              <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
              <span>{t(a.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {(tool === 'pen' || tool === 'line' || tool === 'arrow' || tool === 'text') && (
        <ColorPicker
          legendKey="drawing.color"
          colors={PEN_COLORS}
          value={prefs.pen.color}
          onChange={(color) => updatePrefs((p) => ({ ...p, pen: { ...p.pen, color } }))}
        />
      )}

      {(tool === 'line' || tool === 'arrow') && (
        <>
          <WidthPicker
            id={`${id}-line-w`}
            presets={PEN_WIDTHS}
            value={prefs.pen.width}
            color={prefs.pen.color}
            onChange={(width) => updatePrefs((p) => ({ ...p, pen: { ...p.pen, width } }))}
          />
          <fieldset className="tb-field">
            <legend>{t('drawing.lineStyle')}</legend>
            <div
              className="tb-segmented tb-segmented-3"
              role="radiogroup"
              aria-label={t('drawing.lineStyle')}
            >
              {LINE_DASHES.map((dash) => (
                <button
                  key={dash}
                  type="button"
                  role="radio"
                  aria-checked={prefs.shape.dash === dash}
                  onClick={() => updatePrefs((p) => ({ ...p, shape: { ...p.shape, dash } }))}
                >
                  {t(`drawing.lineStyle.${dash}`)}
                </button>
              ))}
            </div>
            {tool === 'arrow' && (
              <label className="tb-check">
                <input
                  type="checkbox"
                  checked={prefs.shape.arrowStart}
                  onChange={(e) =>
                    updatePrefs((p) => ({
                      ...p,
                      shape: { ...p.shape, arrowStart: e.target.checked },
                    }))
                  }
                />
                {t('drawing.arrowStart')}
              </label>
            )}
            <p className="tb-help">{t('drawing.lineHelp')}</p>
          </fieldset>
        </>
      )}

      {tool === 'text' && (
        <fieldset className="tb-field">
          <legend>{t('drawing.textSize')}</legend>
          <div className="tb-width-presets">
            {TEXT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className="tb-width-btn"
                aria-pressed={prefs.text.fontSize === size}
                aria-label={t('drawing.sizeValue', { n: size })}
                onClick={() => updatePrefs((p) => ({ ...p, text: { ...p.text, fontSize: size } }))}
                style={{ fontSize: Math.min(24, 10 + size / 5) }}
              >
                א
              </button>
            ))}
          </div>
          <label className="tb-check">
            <input
              type="checkbox"
              checked={prefs.text.bold}
              onChange={(e) =>
                updatePrefs((p) => ({ ...p, text: { ...p.text, bold: e.target.checked } }))
              }
            />
            {t('drawing.textBold')}
          </label>
          <p className="tb-help">{t('drawing.textHelp')}</p>
        </fieldset>
      )}

      {tool === 'pen' && (
        <>
          <WidthPicker
            id={`${id}-pen-w`}
            presets={PEN_WIDTHS}
            value={prefs.pen.width}
            color={prefs.pen.color}
            onChange={(width) => updatePrefs((p) => ({ ...p, pen: { ...p.pen, width } }))}
          />
          <div className="tb-field">
            <label className="tb-slider-label" htmlFor={`${id}-op`}>
              {t('drawing.opacity')} <output>{Math.round(prefs.pen.opacity * 100)}%</output>
            </label>
            <input
              id={`${id}-op`}
              type="range"
              min={10}
              max={100}
              step={5}
              value={Math.round(prefs.pen.opacity * 100)}
              onChange={(e) =>
                updatePrefs((p) => ({
                  ...p,
                  pen: { ...p.pen, opacity: Number(e.target.value) / 100 },
                }))
              }
            />
          </div>
          <div className="tb-field">
            <label className="tb-check">
              <input
                type="checkbox"
                checked={prefs.usePressure}
                onChange={(e) => updatePrefs((p) => ({ ...p, usePressure: e.target.checked }))}
              />
              {t('drawing.usePressure')}
            </label>
            <p className="tb-help" data-testid="pressure-status">
              {!penDetected
                ? t('drawing.pressure.noPen')
                : pressureDetected
                  ? t('drawing.pressure.detected')
                  : t('drawing.pressure.notDetected')}
            </p>
          </div>
        </>
      )}

      {tool === 'highlighter' && (
        <>
          <ColorPicker
            legendKey="drawing.color"
            colors={HIGHLIGHTER_COLORS}
            value={prefs.highlighter.color}
            onChange={(color) =>
              updatePrefs((p) => ({ ...p, highlighter: { ...p.highlighter, color } }))
            }
          />
          <WidthPicker
            id={`${id}-hl-w`}
            presets={HIGHLIGHTER_WIDTHS}
            value={prefs.highlighter.width}
            color={prefs.highlighter.color}
            onChange={(width) =>
              updatePrefs((p) => ({ ...p, highlighter: { ...p.highlighter, width } }))
            }
          />
        </>
      )}

      {(tool === 'pen' || tool === 'highlighter') && (
        <fieldset className="tb-field">
          <legend>{t('drawing.smoothing')}</legend>
          <div className="tb-segmented" role="radiogroup" aria-label={t('drawing.smoothing')}>
            {SMOOTHING_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={prefs.smoothing === level}
                onClick={() => updatePrefs((p) => ({ ...p, smoothing: level }))}
              >
                {t(`drawing.smoothing.${level}`)}
              </button>
            ))}
          </div>
          <p className="tb-help">{t('drawing.smoothing.help')}</p>
        </fieldset>
      )}

      {tool === 'eraser' && (
        <>
          <fieldset className="tb-field">
            <legend>{t('drawing.eraserMode')}</legend>
            {(['stroke', 'area'] as EraserMode[]).map((mode) => (
              <label key={mode} className="tb-radio">
                <input
                  type="radio"
                  name={`${id}-eraser-mode`}
                  checked={prefs.eraser.mode === mode}
                  onChange={() => updatePrefs((p) => ({ ...p, eraser: { ...p.eraser, mode } }))}
                />
                {t(`drawing.eraserMode.${mode}`)}
              </label>
            ))}
          </fieldset>
          <fieldset className="tb-field">
            <legend>{t('drawing.eraserSize')}</legend>
            <div className="tb-width-presets">
              {ERASER_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className="tb-width-btn"
                  aria-pressed={prefs.eraser.size === size}
                  aria-label={t('drawing.sizeValue', { n: size })}
                  onClick={() => updatePrefs((p) => ({ ...p, eraser: { ...p.eraser, size } }))}
                >
                  <span
                    className="tb-eraser-dot"
                    style={{ width: size / 2 + 6, height: size / 2 + 6 }}
                  />
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {tool === 'select' && (
        <div className="tb-field">
          <p className="tb-help">{t('drawing.selectHelp')}</p>
          <p className="tb-help">{t('drawing.lockedHelp')}</p>
          <div className="tb-button-row">
            <ActionButton id="edit.unlockAll" tooltipSide="below" />
          </div>
          <button
            type="button"
            className="tb-btn"
            disabled={selection.length === 0}
            onClick={() => ACTIONS['edit.deleteSelection'].run(rt)}
          >
            {t('drawing.deleteSelection', { n: selection.length })}
          </button>
        </div>
      )}

      {tool === 'hand' && <p className="tb-help">{t('drawing.handHelp')}</p>}

      <div className="tb-field tb-panel-footer">
        <button
          type="button"
          className="tb-btn tb-btn-danger-outline"
          disabled={isEmpty}
          onClick={() => setConfirmClear(true)}
        >
          {t('drawing.clearPage')}
        </button>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title={t('drawing.clearPage.title')}
          message={t('drawing.clearPage.message')}
          confirmLabel={t('drawing.clearPage.confirm')}
          cancelLabel={t('common.cancel')}
          danger
          onConfirm={() => {
            rt.board.getState().clearPage();
            setConfirmClear(false);
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </SidePanel>
  );
}

function ColorPicker({
  legendKey,
  colors,
  value,
  onChange,
}: {
  legendKey: MessageKey;
  colors: readonly string[];
  value: string;
  onChange(color: string): void;
}) {
  const id = useId();
  const favorites = useBoard((s) => s.prefs.favorites);
  const updatePrefs = useBoard((s) => s.updatePrefs);
  const custom = !colors.includes(value) && !favorites.includes(value);
  return (
    <fieldset className="tb-field">
      <legend>{t(legendKey)}</legend>
      <div className="tb-swatches">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            className="tb-swatch"
            style={{ background: c }}
            aria-pressed={value === c}
            aria-label={t('drawing.colorValue', { color: c })}
            onClick={() => onChange(c)}
          />
        ))}
        <label
          className="tb-swatch tb-swatch-custom"
          aria-pressed={custom}
          htmlFor={id}
          title={t('drawing.customColor')}
        >
          <input
            id={id}
            type="color"
            value={value}
            aria-label={t('drawing.customColor')}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      </div>
      <div className="tb-favorites" aria-label={t('drawing.favorites')} role="group">
        <span className="tb-favorites-title">{t('drawing.favorites')}</span>
        <div className="tb-swatches">
          {favorites.map((c) => (
            <span key={c} className="tb-fav">
              <button
                type="button"
                className="tb-swatch"
                style={{ background: c }}
                aria-pressed={value === c}
                aria-label={t('drawing.colorValue', { color: c })}
                onClick={() => onChange(c)}
              />
              <button
                type="button"
                className="tb-fav-remove"
                aria-label={t('drawing.favorites.remove', { color: c })}
                title={t('drawing.favorites.remove', { color: c })}
                onClick={() =>
                  updatePrefs((p) => ({ ...p, favorites: p.favorites.filter((f) => f !== c) }))
                }
              >
                <X size={10} aria-hidden="true" />
              </button>
            </span>
          ))}
          {!favorites.includes(value) && favorites.length < MAX_FAVORITES && (
            <IconButton
              icon={Plus}
              className="tb-fav-add"
              label={t('drawing.favorites.add')}
              tooltipSide="below"
              onClick={() => updatePrefs((p) => ({ ...p, favorites: [...p.favorites, value] }))}
            />
          )}
        </div>
      </div>
    </fieldset>
  );
}

function WidthPicker({
  id,
  presets,
  value,
  color,
  onChange,
}: {
  id: string;
  presets: readonly number[];
  value: number;
  color: string;
  onChange(width: number): void;
}) {
  return (
    <fieldset className="tb-field">
      <legend>{t('drawing.width')}</legend>
      <div className="tb-width-presets">
        {presets.map((w) => (
          <button
            key={w}
            type="button"
            className="tb-width-btn"
            aria-pressed={value === w}
            aria-label={t('drawing.sizeValue', { n: w })}
            onClick={() => onChange(w)}
          >
            <span
              className="tb-width-dot"
              style={{ width: Math.min(w, 30), height: Math.min(w, 30), background: color }}
            />
          </button>
        ))}
      </div>
      <label className="tb-slider-label" htmlFor={id}>
        {t('drawing.widthExact')} <output>{value}</output>
      </label>
      <input
        id={id}
        type="range"
        min={WIDTH_LIMITS.min}
        max={WIDTH_LIMITS.max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </fieldset>
  );
}
