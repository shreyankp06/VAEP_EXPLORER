import type { LeaderboardResponse } from '@workspace/api-client-react';
import { mockTopPlayers } from './players';

export const mockLeaderboard: LeaderboardResponse = {
  players: mockTopPlayers.sort((a, b) => b.totalVaep - a.totalVaep),
  total: 5,
  offset: 0,
  limit: 100,
};
