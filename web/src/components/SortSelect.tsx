import type { Sort } from '../types';
import styles from './Filters.module.css';

const OPTIONS: { value: Sort; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name: A to Z' },
  { value: 'rating', label: 'Best rated' },
];

interface SortSelectProps {
  value: Sort;
  onChange: (value: Sort) => void;
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <label className={styles.select}>
      <span className={styles.legend}>Sort by</span>
      <select value={value} onChange={(event) => onChange(event.target.value as Sort)}>
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
