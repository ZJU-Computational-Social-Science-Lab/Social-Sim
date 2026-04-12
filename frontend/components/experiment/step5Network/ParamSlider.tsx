export function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  isInteger,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  isInteger?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="ss-structure-workflow__slider">
      <div className="ss-structure-workflow__slider-head">
        <span>{label}</span>
        <strong>{isInteger ? value : value.toFixed(2)}</strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) =>
          onChange(isInteger ? parseInt(event.target.value, 10) : parseFloat(event.target.value))
        }
        className="ss-structure-workflow__slider-input"
      />
    </div>
  );
}
