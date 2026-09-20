import { useQuery } from '@tanstack/react-query';
import { getActionTypeBreakdown, getStatsOverview, getTopPlayers, type StatsOverview, type PlayerStat, type ActionTypeBreakdown } from '@workspace/api-client-react';

export const useGetStatsOverview = () =>
  useQuery<StatsOverview>({
    queryKey: ['stats', 'overview'],
    queryFn: () => getStatsOverview(),
  });

export const useGetTopPlayers = () =>
  useQuery<PlayerStat[]>({
    queryKey: ['stats', 'top-players'],
    queryFn: () => getTopPlayers(),
  });

export const useGetActionTypeBreakdown = () =>
  useQuery<ActionTypeBreakdown[]>({
    queryKey: ['stats', 'action-type-breakdown'],
    queryFn: () => getActionTypeBreakdown(),
  });
