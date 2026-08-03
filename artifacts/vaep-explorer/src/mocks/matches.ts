import type { Match } from '@workspace/api-client-react';

export const mockMatches: Match[] = [
  {
    id: 1,
    matchId: 1001,
    homeTeam: "Barcelona",
    awayTeam: "Real Madrid",
    homeScore: 2,
    awayScore: 1,
    competition: "La Liga",
    season: "2023/24",
  },
  {
    id: 2,
    matchId: 1002,
    homeTeam: "Manchester City",
    awayTeam: "Liverpool",
    homeScore: 1,
    awayScore: 1,
    competition: "Premier League",
    season: "2023/24",
  },
  {
    id: 3,
    matchId: 1003,
    homeTeam: "PSG",
    awayTeam: "Bayern Munich",
    homeScore: 3,
    awayScore: 2,
    competition: "Champions League",
    season: "2023/24",
  }
];
