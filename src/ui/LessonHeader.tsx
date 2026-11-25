import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useStore } from 'zustand';
import { useRuntime } from '../app/StoreContext';
import { t } from '../i18n';

/** שם השיעור (ניתן לעריכה) ומצב השמירה, בסרגל העליון. */
export function LessonHeader() {
  const rt = useRuntime();
  const title = useStore(rt.lessons, (s) => s.title);
  const status = useStore(rt.lessons, (s) => s.status);
  const error = useStore(rt.lessons, (s) => s.error);
  // בזמן עריכה מוצג הטקסט שהמורה מקליד; אחרת – השם השמור.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft !== null && draft.trim() !== title) void rt.lessons.getState().renameCurrent(draft);
    setDraft(null);
  };

  const label =
    status === 'error'
      ? t('save.error')
      : status === 'saving'
        ? t('save.saving')
        : status === 'dirty'
          ? t('save.dirty')
          : status === 'loading'
            ? t('save.loading')
            : t('save.saved');
  const Icon = status === 'error' ? AlertTriangle : status === 'saved' ? Check : Loader2;

  return (
    <div className="tb-lesson">
      <input
        className="tb-lesson-title"
        aria-label={t('lesson.title')}
        value={draft ?? title}
        maxLength={120}
        onFocus={() => setDraft(title)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(title);
            setTimeout(() => (e.target as HTMLInputElement).blur());
          }
        }}
      />
      <span
        className={`tb-save tb-save-${status}`}
        role="status"
        title={status === 'error' && error ? `${label}\n${error}` : label}
        aria-label={label}
        data-testid="save-status"
        data-status={status}
      >
        <Icon size={16} aria-hidden="true" />
        <span className="tb-save-text">{label}</span>
      </span>
    </div>
  );
}
