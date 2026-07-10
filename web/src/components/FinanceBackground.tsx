// A decorative, money/stocks/bonds-themed backdrop for the login screen —
// a rising market line, scattered world-currency glyphs, coins, and faint ledger rules,
// all in the navy + gold palette of the Wallet Whisperer mark.
export default function FinanceBackground() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ww-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#081521" />
          <stop offset="55%" stopColor="#0f2942" />
          <stop offset="100%" stopColor="#1c3f61" />
        </linearGradient>
        <linearGradient id="ww-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8A33D" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#E8A33D" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="1440" height="900" fill="url(#ww-bg)" />

      {/* faint ledger rules */}
      <g stroke="#F2C572" strokeOpacity="0.06" strokeWidth="1">
        <line x1="0" y1="120" x2="1440" y2="120" />
        <line x1="0" y1="280" x2="1440" y2="280" />
        <line x1="0" y1="440" x2="1440" y2="440" />
        <line x1="0" y1="600" x2="1440" y2="600" />
        <line x1="0" y1="760" x2="1440" y2="760" />
      </g>

      {/* rising market line + area */}
      <path
        d="M0,650 L150,600 L300,625 L450,520 L600,545 L750,415 L900,445 L1050,315 L1200,345 L1440,215 L1440,900 L0,900 Z"
        fill="url(#ww-chart-fill)"
      />
      <polyline
        points="0,650 150,600 300,625 450,520 600,545 750,415 900,445 1050,315 1200,345 1440,215"
        fill="none"
        stroke="#E8A33D"
        strokeOpacity="0.55"
        strokeWidth="2.5"
      />
      <g fill="#E8A33D" fillOpacity="0.65">
        <circle cx="450" cy="520" r="4" />
        <circle cx="750" cy="415" r="4" />
        <circle cx="1050" cy="315" r="4" />
        <circle cx="1200" cy="345" r="4" />
        <circle cx="1440" cy="215" r="4" />
      </g>

      {/* scattered world-currency glyphs */}
      <g fill="#F2C572" fillOpacity="0.13" fontFamily="'Baloo 2', sans-serif" fontWeight="700">
        <text x="110" y="130" fontSize="48">$</text>
        <text x="1290" y="700" fontSize="60">₹</text>
        <text x="890" y="150" fontSize="40">€</text>
        <text x="190" y="790" fontSize="52">£</text>
        <text x="1140" y="110" fontSize="36">¥</text>
        <text x="55" y="480" fontSize="44">₩</text>
        <text x="1370" y="440" fontSize="38">₺</text>
        <text x="610" y="830" fontSize="42">₪</text>
        <text x="740" y="740" fontSize="30">₱</text>
        <text x="1250" y="560" fontSize="34">฿</text>
        <text x="330" y="200" fontSize="30">₽</text>
      </g>

      {/* coins */}
      <g stroke="#F2C572" strokeOpacity="0.16" strokeWidth="2" fill="none">
        <circle cx="1250" cy="180" r="34" />
        <circle cx="1250" cy="180" r="24" />
        <circle cx="170" cy="640" r="26" />
        <circle cx="170" cy="640" r="18" />
        <circle cx="980" cy="700" r="20" />
      </g>
    </svg>
  );
}
