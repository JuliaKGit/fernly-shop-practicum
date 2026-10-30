import { useEffect, type ReactNode } from 'react';
import styles from './Feedback.module.css';

interface EmptyStateProps {
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        🌱
      </span>
      <h2 className={styles.emptyTitle}>{title}</h2>
      {message ? <p className={styles.emptyMessage}>{message}</p> : null}
      {action}
    </div>
  );
}

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className={styles.error} role="alert">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

interface ToastProps {
  message: string;
  tone?: 'success' | 'error';
  onClose: () => void;
  /** Milliseconds before the toast closes itself. 0 keeps it open. */
  duration?: number;
}

export function Toast({ message, tone = 'success', onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (!duration) return undefined;
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`${styles.toast} ${tone === 'error' ? styles.toastError : styles.toastSuccess}`} role="status">
      <span>{message}</span>
      <button type="button" className={styles.close} aria-label="Dismiss" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
