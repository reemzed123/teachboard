import { createStore } from 'zustand/vanilla';

// מצב התוכנה כאפליקציה: התקנה, חיבור לאינטרנט, ואחסון קבוע.

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaState {
  /** האם הדפדפן מציע התקנה עכשיו */
  canInstall: boolean;
  /** התוכנה פתוחה כאפליקציה מותקנת (חלון נפרד) */
  installed: boolean;
  online: boolean;
  /** האם הדפדפן התחייב לא למחוק את השיעורים אוטומטית */
  persisted: boolean | null;
  /** כמה מקום השיעורים תופסים (בתים), אם ידוע */
  usage: number | null;
  quota: number | null;
}

let deferred: InstallPromptEvent | null = null;

export const pwa = createStore<PwaState>(() => ({
  canInstall: false,
  installed: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  persisted: null,
  usage: null,
  quota: null,
}));

function standalone(): boolean {
  return (
    typeof matchMedia === 'function' &&
    (matchMedia('(display-mode: standalone)').matches ||
      matchMedia('(display-mode: window-controls-overlay)').matches)
  );
}

export async function refreshStorage(): Promise<void> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
  if (!storage) return;
  try {
    const [persisted, estimate] = await Promise.all([
      storage.persisted?.() ?? Promise.resolve(false),
      storage.estimate?.() ?? Promise.resolve({} as StorageEstimate),
    ]);
    pwa.setState({ persisted, usage: estimate.usage ?? null, quota: estimate.quota ?? null });
  } catch {
    // לא נתמך – לא מציגים
  }
}

/** בקשה מהדפדפן לשמור את השיעורים לתמיד (לא למחוק כשחסר מקום) */
export async function requestPersistence(): Promise<boolean> {
  try {
    const ok = (await navigator.storage?.persist?.()) ?? false;
    await refreshStorage();
    return ok;
  } catch {
    return false;
  }
}

/** פתיחת חלון ההתקנה של הדפדפן. מחזיר האם המשתמש אישר. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  pwa.setState({ canInstall: false });
  await e.prompt();
  const choice = await e.userChoice;
  return choice.outcome === 'accepted';
}

export function installPwaListeners(): () => void {
  if (typeof window === 'undefined') return () => {};
  pwa.setState({ installed: standalone(), online: navigator.onLine });
  const onPrompt = (e: Event) => {
    e.preventDefault(); // מציגים כפתור משלנו בהגדרות במקום הבאנר של הדפדפן
    deferred = e as InstallPromptEvent;
    pwa.setState({ canInstall: true });
  };
  const onInstalled = () => {
    deferred = null;
    pwa.setState({ canInstall: false, installed: true });
  };
  const onOnline = () => pwa.setState({ online: true });
  const onOffline = () => pwa.setState({ online: false });
  window.addEventListener('beforeinstallprompt', onPrompt);
  window.addEventListener('appinstalled', onInstalled);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  void refreshStorage();
  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt);
    window.removeEventListener('appinstalled', onInstalled);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
