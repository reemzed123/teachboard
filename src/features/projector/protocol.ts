import type { BoardDocument, InkObject } from '../../core/document/types';
import type { Instruments } from '../../core/instruments';
import type { Rect } from '../../core/geometry/rect';
import type { TeachingState } from '../teaching/teachingStore';

// מסך מקרן: חלון נוסף שמציג רק את הלוח. התקשורת בין החלונות – BroadcastChannel (באותו מחשב).

export const PROJECTOR_CHANNEL = 'teachboard-projector';

export type TeachingMirror = Pick<TeachingState, 'spotlight' | 'cover' | 'clock'>;

export type ProjectorMessage =
  /** המקרן נפתח ומבקש את המצב המלא */
  | { type: 'hello' }
  /** המסמך השתנה */
  | { type: 'doc'; doc: BoardDocument; pageId: string }
  /** תצוגה, כלים וכלי הוראה */
  | {
      type: 'view';
      pageId: string;
      /** האזור שהמורה רואה (קואורדינטות לוח) */
      visible: Rect;
      instruments: Instruments;
      teaching: TeachingMirror;
      laser: boolean;
    }
  /** מיקום העט/העכבר על הלוח (ללייזר ולזרקור), והקו שנכתב כרגע */
  | { type: 'pointer'; pointer: { x: number; y: number } | null; live: InkObject | null }
  /** המורה סגר את התוכנה */
  | { type: 'bye' };
