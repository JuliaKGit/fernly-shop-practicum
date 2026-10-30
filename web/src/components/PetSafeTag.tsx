import styles from './PetSafeTag.module.css';

export function PetSafeTag({ petSafe }: { petSafe: boolean }) {
  return (
    <span className={`${styles.tag} ${petSafe ? styles.safe : styles.unsafe}`}>
      <span aria-hidden="true">{petSafe ? '🐾' : '⚠'}</span> {petSafe ? 'Pet safe' : 'Not pet safe'}
    </span>
  );
}
