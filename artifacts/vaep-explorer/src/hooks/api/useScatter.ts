import { useQuery } from '@tanstack/react-query';
import type { ScatterPoint } from '@workspace/api-client-react';
import { mockScatterData } from '@/mocks/scatter';

export const useGetScatterData = (params?: { team?: string; position?: string; minActions?: number }) =>
  useQuery<ScatterPoint[]>({
    queryKey: ['scatter', params],
    queryFn: () => Promise.resolve(mockScatterData),
  });
