import { useState } from 'react';
import { useBoard, useRuntime } from '../app/StoreContext';
import { currentPage } from '../features/board/boardStore';
import { t } from '../i18n';
import type { MessageKey } from '../i18n/he';
import { pickFile } from '../platform/web/files';
import { IMAGE_TYPES } from '../features/lessons/assetCache';

/** תמונת רקע לעמוד (נשמרת בתוך השיעור). */
export function BackgroundImagePicker() {
  const rt = useRuntime();
  const bg = useBoard((s) => currentPage(s).background);
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    const file = await pickFile(IMAGE_TYPES.join(','));
    if (!file) return;
    setBusy(true);
    try {
      const id = await rt.assets.addFromFile(file);
      rt.board.getState().setPageProps({ background: { ...bg, imageAssetId: id } });
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      const key = `background.image.error.${code}` as MessageKey;
      rt.app
        .getState()
        .notify(
          'error',
          code === 'imageTooLarge' || code === 'imageType' ? t(key) : t('files.error.read'),
        );
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className="tb-field">
      <legend>{t('background.image')}</legend>
      <div className="tb-button-row">
        <button type="button" className="tb-btn" disabled={busy} onClick={() => void choose()}>
          {t('background.image.choose')}
        </button>
        {bg.imageAssetId && (
          <button
            type="button"
            className="tb-btn"
            onClick={() => {
              const next = { ...bg };
              delete next.imageAssetId;
              rt.board.getState().setPageProps({ background: next });
            }}
          >
            {t('background.image.remove')}
          </button>
        )}
      </div>
      <p className="tb-help">{t('background.image.help')}</p>
    </fieldset>
  );
}
