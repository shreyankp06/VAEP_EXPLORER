import { useQuery } from '@tanstack/react-query';
import { getPlayer, listPlayerActions, type PlayerDetail, type Action } from '@workspace/api-client-react';

export const useGetPlayer = (playerId: number | undefined) =>
  useQuery<PlayerDetail>({
    queryKey: ['players', playerId],
    queryFn: () => playerId === undefined ? Promise.reject(new Error('playerId is required')) : getPlayer(playerId),
    enabled: !!playerId,
  });

export const useListPlayerActions = (playerId: number | undefined) =>
  useQuery<Action[]>({
    queryKey: ['players', playerId, 'actions'],
    queryFn: () => playerId === undefined ? Promise.reject(new Error('playerId is required')) : listPlayerActions(playerId),
    enabled: !!playerId,
  });
