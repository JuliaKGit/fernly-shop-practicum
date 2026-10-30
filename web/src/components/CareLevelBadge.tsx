import styles from './CareLevelBadge.module.css';

const LABELS = ['Easy', 'Moderate', 'Expert'] as const;

export function CareLevelBadge({ level }: { level: 1 | 2 | 3 }) {
  const label = LABELS[Math.min(level, LABELS.length - 1) - 1];
  return (
    <span className={`${styles.badge} ${styles[`level${level}`]}`} title="How much care this plant needs">
      <span aria-hidden="true">{'●'.repeat(level)}</span> {label} care
    </span>
  );
}
