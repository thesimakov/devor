import { useEffect, useState } from "react";

/** Таймер до endMs (локальное время), обновление раз в секунду. */
export default function AuctionCountdownBadge({ endMs, endedLabel }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = endMs - now;
  const totalSec = Math.max(0, Math.floor(left / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (left <= 0) {
    return <span className="youla-auction-timer youla-auction-timer--ended">{endedLabel}</span>;
  }
  return (
    <span className="youla-auction-timer">
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}
