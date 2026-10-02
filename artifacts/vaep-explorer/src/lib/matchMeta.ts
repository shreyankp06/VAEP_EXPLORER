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
};

export function matchVenue(match: Match) {
  return VENUES[match.homeTeam] ?? match.competition;
}

export function matchDate(match: Match) {
  return DATES[match.matchId] ?? match.season;
}

export function matchStatus(_match: Match) {
  return 'Full time';
}
