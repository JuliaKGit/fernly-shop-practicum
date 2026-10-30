import { formatPrice } from '../money';
import styles from './PriceTag.module.css';

interface PriceTagProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  /** Read by screen readers before the price, e.g. "Subtotal". Not shown. */
  label?: string;
}

export function PriceTag({ amount, size = 'md', label }: PriceTagProps) {
  return (
    <span className={`${styles.price} ${styles[size]}`}>
      {label ? <span className="visually-hidden">{label}: </span> : null}
      {formatPrice(amount)}
    </span>
  );
}
