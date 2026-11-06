import { createTheme } from '@mui/material/styles';

export const statusColors = {
  added: { main: '#1b873f', bg: '#e6f6ea', line: '#c9ecd3', label: 'Added' },
  removed: { main: '#c62828', bg: '#fdeaea', line: '#f8d0d3', label: 'Removed' },
  modified: { main: '#9a6700', bg: '#fff5cc', line: '#ffe9a0', label: 'Modified' },
  unchanged: { main: '#5b6b7b', bg: '#f1f3f5', line: '#e6e9ec', label: 'Unchanged' },
} as const;

export const headerBg = '#0b2a4f';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1565c0' },
    background: { default: '#f4f7fb', paper: '#ffffff' },
    divider: '#dde4ee',
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", "Roboto", "Segoe UI", system-ui, -apple-system, sans-serif',
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderRadius: 12, boxShadow: '0 1px 3px rgba(16,42,80,0.06)' } },
    },
  },
});
