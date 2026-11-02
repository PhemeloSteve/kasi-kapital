/** A simple accessible progress bar in the brand green. */
export function ProgressBar({
  percent,
  label,
  large,
}: {
  percent: number;
  label: string;
  large?: boolean;
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`overflow-hidden rounded-full bg-gray-100 ${large ? "h-4" : "h-2.5"}`}
    >
      <div
        className="h-full rounded-full bg-brand transition-all"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
