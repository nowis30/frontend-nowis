import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

import App from './App';
import { QueryClientProvider } from './providers/QueryProvider';

const rootElement = document.getElementById('root');
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0D47A1'
    },
    secondary: {
      main: '#00695C'
    }
  }
});

const routerFutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
} as const;

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider>
          <BrowserRouter future={routerFutureConfig}>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
}
