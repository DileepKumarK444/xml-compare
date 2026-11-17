import './index.css';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppStateProvider } from './state/AppState';
import { theme } from './theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppStateProvider format="xml">
        <AppStateProvider format="json">
          <AppStateProvider format="text">
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AppStateProvider>
        </AppStateProvider>
      </AppStateProvider>
    </ThemeProvider>
  </StrictMode>,
);
