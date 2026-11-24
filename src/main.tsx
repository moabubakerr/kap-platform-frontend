import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/index.css';
import { router } from './app/routes';
import { TooltipProvider } from './components/ui/menu';
import { AccessProvider } from './v35/access';
import { DialogsProvider } from './engine/dialogs';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AccessProvider>
          <DialogsProvider>
            <RouterProvider router={router} />
          </DialogsProvider>
        </AccessProvider>
        <Toaster position="bottom-right" toastOptions={{ style: { fontFamily: 'var(--font-sans)', borderRadius: 4 } }} />
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
