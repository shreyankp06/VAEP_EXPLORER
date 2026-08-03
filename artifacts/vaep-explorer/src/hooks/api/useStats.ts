import { useQuery } from '@tanstack/react-query';
import type { StatsOverview, PlayerStat, ActionTypeBreakdown } from '@workspace/api-client-react';
import { mockStatsOverview } from '@/mocks/statsOverview';
import { mockTopPlayers } from '@/mocks/players';
import { mockActionTypeBreakdown } from '@/mocks/actionTypes';

export const useGetStatsOverview = () =>
  useQuery<StatsOverview>({
    queryKey: ['stats', 'overview'],
    queryFn: () => Promise.resolve(mockStatsOverview),
  });

export const useGetTopPlayers = () =>
  useQuery<PlayerStat[]>({
    queryKey: ['stats', 'top-players'],
    queryFn: () => Promise.resolve(mockTopPlayers),
  });

export const useGetActionTypeBreakdown = () =>
  useQuery<ActionTypeBreakdown[]>({
    queryKey: ['stats', 'action-type-breakdown'],
    queryFn: () => Promise.resolve(mockActionTypeBreakdown),
  });
