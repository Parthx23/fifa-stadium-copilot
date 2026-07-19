const ITEMS = [
  "MetLife Stadium — Capacity 82,500",
  "Argentina vs Brazil kicks off 15:00",
  "Gate D transport running on time",
  "Accessible seating desks open at every gate",
  "Guest Services at every concourse level",
];

export default function Ticker() {
  return (
    <div className="ticker" role="status" aria-label="Matchday status ticker">
      <div className="ticker__track">
        {ITEMS.concat(ITEMS).map((item, i) => (
          <span key={i}>{item}</span>
        ))}
      </div>
    </div>
  );
}
