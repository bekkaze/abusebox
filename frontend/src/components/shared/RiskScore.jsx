/**
 * The 0-100 priority score an asset's findings add up to.
 *
 * The number is only half of it. A score you cannot take apart is a number to
 * argue with, so the badge carries the factors that produced it in its
 * tooltip, and the panel below spells them out. Both come from the backend
 * (see services/risk.py), which is also where the weights live.
 *
 * Bands are for colour only. They are not a second scale, and the number is
 * always shown beside them, because "62" ranks and "High" does not.
 */

const BANDS = [
  { from: 60, label: 'High', text: 'text-s5', chip: 'bg-s5-soft text-s5' },
  { from: 30, label: 'Elevated', text: 'text-s4', chip: 'bg-s4-soft text-s4' },
  { from: 1, label: 'Low', text: 'text-ink-2', chip: 'bg-sunk text-ink-2' },
  { from: 0, label: 'None', text: 'text-s2', chip: 'bg-s2-soft text-s2' },
];

function riskBand(score) {
  return BANDS.find((band) => score >= band.from) || BANDS[BANDS.length - 1];
}

const FACTOR_LABELS = {
  blacklist: 'Blacklists',
  reachability: 'Reachability',
  certificate: 'Certificate',
  domain: 'Domain',
  email_auth: 'Email auth',
  reputation: 'Reputation',
};

/** Compact score for a row or a card. */
export function RiskBadge({ risk, className = '' }) {
  if (!risk || typeof risk.score !== 'number') return null;
  const band = riskBand(risk.score);
  const why = (risk.factors || [])
    .map((factor) => `${FACTOR_LABELS[factor.factor] || factor.factor}: ${factor.points} of ${factor.of}${factor.detail ? ` (${factor.detail})` : ''}`)
    .join('\n');
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${band.chip} ${className}`}
      title={why ? `Risk ${risk.score} of 100\n${why}` : `Risk ${risk.score} of 100`}
    >
      <span>{risk.score}</span>
      <span className="font-normal opacity-80">{band.label}</span>
    </span>
  );
}

/** The score with its working shown, for an asset's own page. */
export function RiskBreakdown({ risk }) {
  if (!risk || typeof risk.score !== 'number') return null;
  const band = riskBand(risk.score);
  const factors = risk.factors || [];
  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-baseline gap-x-2.5">
        <span className={`font-mono text-[1.75rem] leading-none font-semibold ${band.text}`}>{risk.score}</span>
        <span className="text-sm text-ink-2">of 100 · {band.label}</span>
      </p>

      {factors.length === 0 ? (
        <p className="text-sm text-ink-2">No findings contribute to a score for this asset.</p>
      ) : (
        <ul className="space-y-1.5">
          {factors.map((factor) => (
            <li key={factor.factor} className="flex items-baseline gap-2 text-sm">
              <span className="w-28 flex-shrink-0 font-mono text-xs text-ink-2">
                {FACTOR_LABELS[factor.factor] || factor.factor}
              </span>
              {/* Width is the share of that factor's own maximum, so a full bar
                  means "as bad as this factor gets" rather than "worst asset". */}
              <span className="relative h-1.5 w-20 flex-shrink-0 overflow-hidden rounded-full bg-sunk" aria-hidden="true">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-accent"
                  style={{ width: `${Math.min(100, (factor.points / factor.of) * 100)}%` }}
                />
              </span>
              <span className="tabular-nums text-ink">{factor.points}</span>
              <span className="text-ink-2">of {factor.of}</span>
              {factor.detail && <span className="min-w-0 truncate text-ink-2" title={factor.detail}>· {factor.detail}</span>}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-ink-2">
        Added up from this asset&apos;s findings to rank it against the others. Not a
        probability: nothing here is calibrated against outcomes.
      </p>
    </div>
  );
}
