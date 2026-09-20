import { useQuery } from '@tanstack/react-query';
import { getScatterData, type GetScatterDataParams, type ScatterPoint } from '@workspace/api-client-react';

export const useGetScatterData = (params?: GetScatterDataParams) =>
  useQuery<ScatterPoint[]>({
    queryKey: ['scatter', params],
    queryFn: () => getScatterData(params),
  });
