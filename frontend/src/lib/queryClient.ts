import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Luôn fetch mới nhất từ server
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});
