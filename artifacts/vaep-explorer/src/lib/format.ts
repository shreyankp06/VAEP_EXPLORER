export const formatVaep = (value: number, digits = 3) => value.toFixed(digits);

export const formatSignedVaep = (value: number, digits = 3) =>
  `${value >= 0 ? '+' : ''}${formatVaep(value, digits)}`;

export const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);

export const formatPercent = (value: number, digits = 1) =>
  `${(value * 100).toFixed(digits)}%`;

export const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${(safe % 60).toString().padStart(2, '0')}`;
};

const PERIOD_START_SECONDS: Record<number, number> = {
  1: 0,
  2: 45 * 60,
  3: 90 * 60,
  4: 105 * 60,
  5: 120 * 60,
};

export const toMatchClockSeconds = (periodId: number, periodSeconds: number) =>
  periodSeconds + (PERIOD_START_SECONDS[periodId] ?? 0);

export const formatActionTime = (periodId: number, matchClockSeconds: number) =>
  periodId === 5
    ? `SO ${formatTime(matchClockSeconds - PERIOD_START_SECONDS[5])}`
    : formatTime(matchClockSeconds);

export const titleCase = (value: string) =>
  value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export const playerAbbr = (name: string) => {
  const parts = name.replace(/\./g, ' ').split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1].slice(0, 2)}`.toUpperCase();
};

export const shirtNumber = (playerId: number) => ((playerId * 7) % 29) + 1;
