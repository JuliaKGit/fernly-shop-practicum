import type { Light } from '../types';
import styles from './Filters.module.css';

const OPTIONS: { value: Light; label: string }[] = [
  { value: 'low', label: 'Low light' },
  { value: 'medium', label: 'Medium light' },
  { value: 'bright', label: 'Bright light' },
];

interface LightFilterProps {
  value: Light[];
  onChange: (value: Light[]) => void;
}

export function LightFilter({ value, onChange }: LightFilterProps) {
  function toggle(light: Light) {
    onChange(value.includes(light) ? value.filter((item) => item !== light) : [...value, light]);
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Light</legend>
      {OPTIONS.map((option) => (
        <label key={option.value} className={styles.option}>
          <input type="checkbox" checked={value.includes(option.value)} onChange={() => toggle(option.value)} />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
