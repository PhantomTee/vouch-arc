const ITEMS = [
  "ESCROW LOCKS BEFORE WORK BEGINS",
  "VERIFIED DELIVERY RELEASES USDC",
  "LOST DISPUTES REFUND THE CLIENT",
  "REPUTATION IS ON-CHAIN, NOT A STAR RATING",
  "SETTLED ON ARC · SUB-SECOND FINALITY",
  "NO HUMAN SIGNS OFF · VERIFICATION DOES",
];

export default function Ticker() {
  const items = [...ITEMS, ...ITEMS];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {items.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  );
}
