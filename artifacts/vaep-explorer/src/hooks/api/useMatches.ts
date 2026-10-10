import { useQuery } from '@tanstack/react-query';
import { getMatchActions, listMatches } from '@workspace/api-client-react';
import type { Match, Action } from '@workspace/api-client-react';
import { toMatchClockSeconds } from '@/lib/format';

export const useListMatches = () =>
  useQuery<Match[]>({
    queryKey: ['matches'],
    queryFn: () => listMatches(),
  });

export const useGetMatchActions = (matchId: number | undefined) =>
  useQuery<Action[]>({
    queryKey: ['matches', matchId, 'actions'],
    queryFn: async () => {
      if (matchId === undefined) throw new Error('matchId is required');
      const actions = await getMatchActions(matchId);
      return actions.map((action) => ({
        ...action,
        timeSeconds: toMatchClockSeconds(action.periodId, action.timeSeconds),
      }));
    },
    enabled: !!matchId,
  });
