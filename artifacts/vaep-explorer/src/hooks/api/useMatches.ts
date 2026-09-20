import { useQuery } from '@tanstack/react-query';
import { getMatchActions, listMatches } from '@workspace/api-client-react';
import type { Match, Action } from '@workspace/api-client-react';

export const useListMatches = () =>
  useQuery<Match[]>({
    queryKey: ['matches'],
    queryFn: () => listMatches(),
  });

export const useGetMatchActions = (matchId: number | undefined) =>
  useQuery<Action[]>({
    queryKey: ['matches', matchId, 'actions'],
    queryFn: () => matchId === undefined ? Promise.reject(new Error('matchId is required')) : getMatchActions(matchId),
    enabled: !!matchId,
  });
