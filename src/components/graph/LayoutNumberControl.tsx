import { useId, useState } from "react";
import styles from "./LayoutNumberControl.module.css";

type LayoutNumberControlProps = {
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

const getPrecision = (step: number) => {
  const stepText = String(step);
  const decimalIndex = stepText.indexOf(".");
  return decimalIndex === -1 ? 0 : stepText.length - decimalIndex - 1;
};

const formatValue = (value: number, step: number) => {
  const precision = getPrecision(step);
  return precision === 0
    ? String(value)
    : String(Number(value.toFixed(precision)));
};

const clampValue = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const LayoutNumberControl = ({
  label,
  description,
  min,
  max,
  step,
  value,
  disabled = false,
  onChange,
}: LayoutNumberControlProps) => {
  const inputId = useId();
  const labelId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? formatValue(value, step);

  const commitDraft = (rawValue: string) => {
    if (
      rawValue === "" ||
      rawValue === "-" ||
      rawValue === "." ||
      rawValue === "-."
    ) {
      setDraft(null);
      return;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
      setDraft(null);
      return;
    }

    const nextValue = parsedValue < min ? min : parsedValue;
    setDraft(null);

    if (nextValue !== value) {
      onChange(nextValue);
    }
  };

  const handleNumberChange = (rawValue: string) => {
    setDraft(rawValue);

    if (
      rawValue === "" ||
      rawValue === "-" ||
      rawValue === "." ||
      rawValue === "-." ||
      rawValue.endsWith(".")
    ) {
      return;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    if (parsedValue < min) {
      return;
    }

    const nextValue = parsedValue;

    if (nextValue !== value) {
      onChange(nextValue);
    }
  };

  return (
    <div className={styles.root} title={description}>
      <div className={styles.header}>
        <label className={styles.label} htmlFor={inputId}>
          <span id={labelId}>{label}</span>
        </label>
        <input
          id={inputId}
          className={styles.valueInput}
          type="number"
          min={min}
          step={step}
          value={displayValue}
          disabled={disabled}
          aria-label={`${label} value`}
          onChange={(event) => handleNumberChange(event.target.value)}
          onBlur={(event) => commitDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitDraft(event.currentTarget.value);
              event.currentTarget.blur();
            }

            if (event.key === "Escape") {
              setDraft(null);
              event.currentTarget.blur();
            }
          }}
        />
      </div>
      <input
        className={styles.range}
        type="range"
        min={min}
        max={max}
        step={step}
        value={clampValue(value, min, max)}
        disabled={disabled}
        aria-labelledby={labelId}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          setDraft(null);
          onChange(nextValue);
        }}
      />
    </div>
  );
};

export default LayoutNumberControl;
