/**
 * North compass (§10): rotates with the layout's north_angle_deg. Directions
 * are never inferred from screen position — this is the only place "up on
 * screen" gets reinterpreted as a real-world direction.
 */
export function Compass({ northAngleDeg }: { northAngleDeg: number }) {
  return (
    <div
      className="absolute top-2 left-2 z-10 flex size-11 items-center justify-center rounded-full border border-input bg-background/90 shadow-sm"
      role="img"
      aria-label={`North is ${northAngleDeg}° clockwise from up on this map`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-7"
        style={{ transform: `rotate(${northAngleDeg}deg)` }}
      >
        <path d="M12 2 L16 14 L12 11 L8 14 Z" fill="#dc2626" />
        <path d="M12 11 L16 14 L12 22 L8 14 Z" fill="#9ca3af" />
      </svg>
      <span
        className="absolute -top-0.5 text-[9px] font-bold"
        style={{ transform: `rotate(${northAngleDeg}deg) translateY(-1px)` }}
      >
        N
      </span>
    </div>
  );
}
