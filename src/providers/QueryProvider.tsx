import { PropsWithChildren, useEffect, useMemo } from 'react';
import { QueryClient, QueryClientProvider as RQProvider } from '@tanstack/react-query';

import { useAuthStore } from '../store/authStore';

export function QueryClientProvider({ children }: PropsWithChildren) {
  const queryClient = useMemo(() => new QueryClient(), []);

  useEffect(() => useAuthStore.subscribe((state, previous) => {
    if (state.token !== previous.token) {
      void queryClient.cancelQueries();
      queryClient.clear();
    }
  }), [queryClient]);

  return <RQProvider client={queryClient}>{children}</RQProvider>;
}
