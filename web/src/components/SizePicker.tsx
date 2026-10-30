import { formatPrice } from '../money';
import type { SizeLabel } from '../types';
import styles from './SizePicker.module.css';

const NAMES: Record<SizeLabel, string> = { S: 'Small', M: 'Medium', L: 'Large' };

interface SizePickerProps {
  sizes: { label: SizeLabel; priceDelta: number }[];
  value: SizeLabel;
  onChange: (size: SizeLabel) => void;
  name?: string;
}

export function SizePicker({ sizes, value, onChange, name = 'size' }: SizePickerProps) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Size</legend>
      <div className={styles.options}>
        {sizes.map((size) => (
          <label key={size.label} className={`${styles.option} ${value === size.label ? styles.checked : ''}`}>
            <input
              type="radio"
              name={name}
              value={size.label}
              checked={value === size.label}
              onChange={() => onChange(size.label)}
            />
            <span className={styles.name}>{NAMES[size.label]}</span>
            <span className={styles.delta}>{size.priceDelta > 0 ? `+${formatPrice(size.priceDelta)}` : 'Base price'}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
