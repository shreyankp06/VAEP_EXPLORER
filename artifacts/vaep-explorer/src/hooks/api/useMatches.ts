import { useQuery } from '@tanstack/react-query';
import type { Match, Action } from '@workspace/api-client-react';
import { mockMatches } from '@/mocks/matches';
import { mockMatchActions } from '@/mocks/actions';

export const useListMatches = () =>
  useQuery<Match[]>({
    queryKey: ['matches'],
    queryFn: () => Promise.resolve(mockMatches),
  });

export const useGetMatchActions = (matchId: number | undefined) =>
  useQuery<Action[]>({
    queryKey: ['matches', matchId, 'actions'],
    queryFn: () => Promise.resolve(mockMatchActions.filter(a => a.matchId === matchId)),
    enabled: !!matchId,
  });
