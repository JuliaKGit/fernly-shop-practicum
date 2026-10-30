import type { CartLine as CartLineData } from '../types';
import { PriceTag } from './PriceTag';
import { QuantityStepper } from './QuantityStepper';
import styles from './CartLine.module.css';

interface CartLineProps {
  line: CartLineData;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  busy?: boolean;
}

export function CartLine({ line, onQuantityChange, onRemove, busy = false }: CartLineProps) {
  return (
    <li className={styles.line}>
      <img src={line.imageUrl} alt="" className={styles.image} />
      <div className={styles.info}>
        <p className={styles.name}>{line.name}</p>
        <p className={styles.meta}>
          Size {line.size} · <PriceTag amount={line.unitPrice} size="sm" label="Price each" /> each
        </p>
      </div>
      <QuantityStepper
        value={line.quantity}
        max={line.stock}
        disabled={busy}
        label={`Quantity of ${line.name}`}
        onChange={(quantity) => onQuantityChange(line.id, quantity)}
      />
      <PriceTag amount={line.lineTotal} label="Line total" />
      <button type="button" className={styles.remove} aria-label={`Remove ${line.name}`} disabled={busy} onClick={() => onRemove(line.id)}>
        Remove
      </button>
    </li>
  );
}
