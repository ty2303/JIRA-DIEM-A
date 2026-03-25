import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import AuthBootstrap from '@/components/AuthBootstrap';
import WebSocketListeners from '@/components/WebSocketListeners';
import ToastContainer from '@/components/ui/ToastContainer';
import { queryClient } from '@/lib/queryClient';
import { router } from '@/router';
import '@/assets/styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap />
      <WebSocketListeners />
      <ToastContainer />
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
