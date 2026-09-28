'use client';

import { alpha, createTheme } from '@mui/material/styles';

const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'dark',
    primary: { main: '#8B7CFF' },
    secondary: { main: '#43D3A2' },
    background: { default: '#0B0D12', paper: '#12151D' },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'var(--font-inter), system-ui, sans-serif',
    h4: { fontWeight: 750, letterSpacing: '-0.04em' },
    h6: { fontWeight: 700, letterSpacing: '-0.02em' },
    button: { textTransform: 'none', fontWeight: 650 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme: muiTheme }) => ({
          backgroundImage: 'none',
          borderColor: alpha(muiTheme.palette.common.white, 0.08),
        }),
      },
    },
  },
});

export default theme;
