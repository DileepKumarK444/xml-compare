import CodeIcon from '@mui/icons-material/Code';
import ComputerIcon from '@mui/icons-material/Computer';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { AppBar, Box, Chip, IconButton, Toolbar, Tooltip, Typography } from '@mui/material';
import { useState, type ReactNode } from 'react';
import { headerBg } from '../theme';
import HelpDialog from './HelpDialog';

export default function AppHeader({ children }: { children?: ReactNode }) {
  const [help, setHelp] = useState(false);
  return (
    <>
      <AppBar position="static" elevation={0} sx={{ bgcolor: headerBg }}>
        <Toolbar sx={{ gap: 2, flexWrap: 'wrap', minHeight: { xs: 56, sm: 60 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                bgcolor: 'rgba(255,255,255,0.12)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <CodeIcon fontSize="small" />
            </Box>
            <Typography variant="h6" component="h1" sx={{ fontSize: 18 }}>
              XML Compare
            </Typography>
          </Box>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            {children}
          </Box>
          <Chip
            icon={<ComputerIcon sx={{ color: '#9bd0ff !important' }} />}
            label="Local Application"
            size="small"
            sx={{
              color: '#fff',
              bgcolor: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          />
          <Tooltip title="About XML Compare">
            <IconButton color="inherit" aria-label="Help" onClick={() => setHelp(true)}>
              <InfoOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <HelpDialog open={help} onClose={() => setHelp(false)} />
    </>
  );
}
