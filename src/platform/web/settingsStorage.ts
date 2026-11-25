import type { SettingsStorage } from '../types';

// ההגדרות נשמרות תחת "פרופיל". כרגע יש פרופיל אחד (default),
// וכך אפשר יהיה בעתיד להוסיף פרופילים נפרדים למורים בלי לשנות את המבנה.
export function createWebSettingsStorage(
  profileId = 'default',
  name = 'settings',
): SettingsStorage {
  const key = `teachboard:${profileId}:${name}`;
  return {
    load() {
      try {
        const text = localStorage.getItem(key);
        return text === null ? null : (JSON.parse(text) as unknown);
      } catch {
        return null;
      }
    },
    save(data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    },
  };
}
