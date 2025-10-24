import { PropsWithChildren, useMemo } from 'react';
import { QueryClient, QueryClientProvider as RQProvider } from '@tanstack/react-query';

export function QueryClientProvider({ children }: PropsWithChildren) {
  const queryClient = useMemo(() => new QueryClient(), []);

  return <RQProvider client={queryClient}>{children}</RQProvider>;
}
