import { useQuery } from '@tanstack/react-query';
import { getLeaderboard, type GetLeaderboardParams, type LeaderboardResponse } from '@workspace/api-client-react';

export const useGetLeaderboard = (params?: GetLeaderboardParams) =>
  useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard', params],
    queryFn: () => getLeaderboard(params),
  });
