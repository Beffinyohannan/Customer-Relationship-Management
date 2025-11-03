import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export function useMe(options = {}) {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get('/auth/me')).data,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    ...options,
  });
}
