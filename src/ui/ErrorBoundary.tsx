import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n';

interface Props {
  children: ReactNode;
  /** מה מוצג במקום החלק שנכשל. ברירת מחדל: הודעה קצרה עם "נסו שוב" */
  fallback?: (retry: () => void) => ReactNode;
  /** אחרי כשל: למשל לסגור את החלון */
  onError?: (error: Error) => void;
}

/**
 * "רשת ביטחון": אם חלק בממשק נכשל, רק החלק הזה נסגר –
 * הלוח והשיעור ממשיכים לעבוד (והשיעור שמור).
 */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('TeachBoard UI error:', error, info.componentStack);
    this.props.onError?.(error);
  }

  private retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.retry);
    return (
      <div className="tb-error-box" role="alert">
        <p>{t('error.part')}</p>
        <button type="button" className="tb-btn" onClick={this.retry}>
          {t('error.retry')}
        </button>
      </div>
    );
  }
}
