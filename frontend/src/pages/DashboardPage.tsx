import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import DataObjectIcon from '@mui/icons-material/DataObject';
import DifferenceOutlinedIcon from '@mui/icons-material/DifferenceOutlined';
import RuleIcon from '@mui/icons-material/Rule';
import { Box, Card, CardActionArea, CardContent, Chip, Container, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useAppState } from '../state/AppState';

interface Tile {
  title: string;
  description: string;
  icon: ReactNode;
  to?: string; // omitted => not available yet
  badge?: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { history } = useAppState();

  const tiles: Tile[] = [
    {
      title: 'XML Compare',
      description:
        'Compare two XML files side by side, by source lines or by structure and content.',
      icon: <CompareArrowsIcon />,
      to: '/xml-compare',
      badge: history.length
        ? `${history.length} past comparison${history.length === 1 ? '' : 's'}`
        : undefined,
    },
    {
      title: 'JSON Compare',
      description: 'Structural comparison for JSON documents.',
      icon: <DataObjectIcon />,
    },
    {
      title: 'Text Diff',
      description: 'Line-by-line diff for any plain-text or code files.',
      icon: <DifferenceOutlinedIcon />,
    },
    {
      title: 'XML Validator',
      description: 'Check well-formedness and validate against a schema.',
      icon: <RuleIcon />,
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppHeader title="Local Toolbox" showHome={false} />
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Dashboard
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          Pick a tool to get started. Everything runs on this computer.
        </Typography>

        <Grid container spacing={3}>
          {tiles.map((t) => {
            const enabled = !!t.to;
            return (
              <Grid key={t.title} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    opacity: enabled ? 1 : 0.6,
                    transition: 'box-shadow .15s, border-color .15s',
                    '&:hover': enabled ? { boxShadow: 4, borderColor: 'primary.main' } : undefined,
                  }}
                >
                  <CardActionArea
                    disabled={!enabled}
                    onClick={() => t.to && navigate(t.to)}
                    sx={{ height: '100%', alignItems: 'flex-start' }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: 2.5,
                          display: 'grid',
                          placeItems: 'center',
                          mb: 2,
                          color: enabled ? 'primary.main' : 'text.secondary',
                          bgcolor: enabled ? 'rgba(21,101,192,0.1)' : 'action.hover',
                          '& svg': { fontSize: 30 },
                        }}
                      >
                        {t.icon}
                      </Box>
                      <Typography variant="h6" component="h3" gutterBottom>
                        {t.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t.description}
                      </Typography>
                      {enabled ? (
                        t.badge && <Chip size="small" label={t.badge} />
                      ) : (
                        <Chip size="small" variant="outlined" label="Coming soon" />
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Container>
    </Box>
  );
}
