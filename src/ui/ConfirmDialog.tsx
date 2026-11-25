import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

/** חלון אישור לפעולות שמוחקות מידע. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
  }, []);

  return (
    <dialog
      ref={ref}
      className="tb-dialog"
      aria-labelledby="tb-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        props.onCancel();
      }}
    >
      <h2 id="tb-dialog-title">{props.title}</h2>
      <p>{props.message}</p>
      <div className="tb-dialog-actions">
        <button
          type="button"
          className={`tb-btn ${props.danger ? 'tb-btn-danger' : 'tb-btn-primary'}`}
          onClick={props.onConfirm}
        >
          {props.confirmLabel}
        </button>
        <button type="button" className="tb-btn" onClick={props.onCancel} autoFocus>
          {props.cancelLabel}
        </button>
      </div>
    </dialog>
  );
}
