import { useQuery } from '@tanstack/react-query';
import type { PlayerDetail, Action } from '@workspace/api-client-react';
import { mockTopPlayers } from '@/mocks/players';
import { mockMatchActions } from '@/mocks/actions';

export const useGetPlayer = (playerId: number | undefined) =>
  useQuery<PlayerDetail>({
    queryKey: ['players', playerId],
    queryFn: () => {
      const p = mockTopPlayers.find(p => p.playerId === playerId) || mockTopPlayers[0];
      return Promise.resolve({
        id: p.id,
        playerId: p.playerId,
        name: p.name,
        team: p.team,
        position: p.position,
        stats: p
      });
    },
    enabled: !!playerId,
  });

export const useListPlayerActions = (playerId: number | undefined) =>
  useQuery<Action[]>({
    queryKey: ['players', playerId, 'actions'],
    queryFn: () => Promise.resolve(mockMatchActions.filter(a => a.playerId === playerId)),
    enabled: !!playerId,
  });
