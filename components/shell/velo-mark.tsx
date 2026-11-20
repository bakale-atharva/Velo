/**
 * Velo's mark: a V drawn as a barcode. Seven hairline bars fall to the
 * centre and rise again, so the letter is made of the same signal as the
 * activity barcode. Takes the current text colour.
 */
const BARS = [
  { x: 0, h: 20, w: 2 },
  { x: 3.5, h: 15, w: 1 },
  { x: 6, h: 10.5, w: 2 },
  { x: 9, h: 6, w: 2 },
  { x: 12, h: 10.5, w: 2 },
  { x: 15.5, h: 15, w: 1 },
  { x: 18, h: 20, w: 2 },
];

export function VeloMark({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" width={size} height={size} className="shrink-0" fill="currentColor">
      {BARS.map((bar) => (
        <rect key={bar.x} x={bar.x} y={0} width={bar.w} height={bar.h} />
      ))}
    </svg>
  );
}
