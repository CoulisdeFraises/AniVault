/**
 * Décor du haut de la page d'accueil : ciel violet, lune, silhouette de
 * pagode et branches de cerisier. Purement décoratif, en SVG inline
 * (aucun asset externe) et fondu vers le fond de page.
 */
export function HomeBackdrop() {
  const petals = [
    [318, 40, 5], [346, 78, 4], [292, 92, 3.5], [360, 20, 3], [268, 30, 3],
    [30, 60, 4], [70, 24, 3], [110, 84, 3.5], [200, 20, 3], [235, 70, 2.5],
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[430px] overflow-hidden"
      style={{ WebkitMaskImage: "linear-gradient(to bottom, #000 55%, transparent)", maskImage: "linear-gradient(to bottom, #000 55%, transparent)" }}>
      <svg viewBox="0 0 390 430" preserveAspectRatio="xMidYMin slice" className="w-full h-full">
        <defs>
          <linearGradient id="hb-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b1a78" /><stop offset="0.6" stopColor="#2a1259" /><stop offset="1" stopColor="#2e1065" />
          </linearGradient>
          <radialGradient id="hb-moon" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fbbf24" stopOpacity="0.55" /><stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="390" height="430" fill="url(#hb-sky)" />
        <circle cx="285" cy="70" r="95" fill="url(#hb-moon)" />
        <circle cx="285" cy="70" r="30" fill="#f59e0b" opacity="0.85" />
        {/* montagnes */}
        <path d="M0 190 L70 130 L130 175 L200 110 L270 170 L330 135 L390 180 L390 260 L0 260Z" fill="#1e0d47" opacity="0.7" />
        {/* pagode */}
        <g fill="#170a38" opacity="0.9">
          <path d="M255 200 h50 l-6 -10 h-38z" /><path d="M262 190 h36 l-5 -9 h-26z" />
          <path d="M269 181 h22 l-4 -8 h-14z" /><rect x="277" y="150" width="6" height="23" />
          <rect x="262" y="200" width="36" height="34" />
        </g>
        {/* branche */}
        <path d="M390 0 C350 20 320 40 280 70 M330 28 C338 50 342 62 348 84 M300 52 C296 68 290 80 282 96"
          stroke="#1a0b3a" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.8" />
        {petals.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#f9a8d4" opacity={0.55 + (i % 3) * 0.15} />
        ))}
      </svg>
    </div>
  );
}
