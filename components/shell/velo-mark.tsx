/** Velo's mark: two chevrons stepping forward, set in a dark rounded tile. */
export function VeloMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="chip-dark inline-grid shrink-0 place-items-center rounded-[9px]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 20 20" width={size * 0.62} height={size * 0.62} fill="none">
        <path d="M4 5.5 9 10l-5 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
        <path d="M10 5.5 15 10l-5 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
