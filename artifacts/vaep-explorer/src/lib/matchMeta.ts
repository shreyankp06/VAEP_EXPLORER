import type { Match } from '@workspace/api-client-react';

const VENUES: Record<string, string> = {
  Barcelona: 'Camp Nou, Barcelona',
  'Real Madrid': 'Santiago Bernabéu, Madrid',
  'Manchester City': 'Etihad Stadium, Manchester',
  Liverpool: 'Anfield, Liverpool',
  PSG: 'Parc des Princes, Paris',
  'Bayern Munich': 'Allianz Arena, Munich',
};

const DATES: Record<number, string> = {
  1001: '21 October 2023',
  1002: '25 November 2023',
  1003: '14 March 2024',
  3857290: '24 November 2022',
};

const COMPETITIONS: Record<string, string> = {
  '43': 'FIFA World Cup',
  '11': 'La Liga',
  '2': 'Premier League',
  '16': 'UEFA Champions League',
};

const SEASONS: Record<string, string> = {
  '106': '2022',
};

const isNumericLabel = (value: string) => /^\d+(?:\.\d+)?$/.test(value.trim());

export function matchCompetition(match: Match) {
  return COMPETITIONS[match.competition] ?? (isNumericLabel(match.competition) ? 'International fixture' : match.competition);
}

export function matchSeason(match: Match) {
  return SEASONS[match.season] ?? (isNumericLabel(match.season) ? `Season ${match.season}` : match.season);
}

export function matchVenue(match: Match) {
  return VENUES[match.homeTeam] ?? 'Venue not recorded';
}

export function matchDate(match: Match) {
  return DATES[match.matchId] ?? matchSeason(match);
}

export function matchStatus(_match: Match) {
  return 'Full time';
}
