import { useQuery } from '@tanstack/react-query';
import type { LeaderboardResponse } from '@workspace/api-client-react';
import { mockLeaderboard } from '@/mocks/leaderboard';

export const useGetLeaderboard = (params?: { sort?: string; limit?: number; offset?: number }) =>
  useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard', params],
    queryFn: () => Promise.resolve(mockLeaderboard),
  });
