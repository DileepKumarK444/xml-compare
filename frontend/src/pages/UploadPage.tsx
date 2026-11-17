import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import { Alert, Box, Button, CircularProgress, Container, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import HistorySection from '../components/HistorySection';
import OptionsPanel from '../components/OptionsPanel';
import UploadCard from '../components/UploadCard';
import { useFormat } from '../formats';
import { useAppState } from '../state/AppState';

export default function UploadPage() {
  const s = useAppState();
  const navigate = useNavigate();
  const cfg = useFormat();
  const ready = !!s.original && !!s.modified && !s.original.error && !s.modified.error;

  const onCompare = async () => {
    if (await s.compare()) navigate(`${cfg.base}/results`);
  };
  const loadSamples = async () => {
    await s.loadFile(
      'original',
      new File([cfg.sample.original], `original${cfg.ext}`, { type: 'text/plain' }),
    );
    await s.loadFile(
      'modified',
      new File([cfg.sample.modified], `modified${cfg.ext}`, { type: 'text/plain' }),
    );
  };

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppHeader />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box>
          <Typography variant="h5" component="h2" gutterBottom>
            Compare two {cfg.name} files
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            1. Upload both files &nbsp;›&nbsp; 2. Choose options and compare &nbsp;›&nbsp; 3. Review
            the differences. Everything stays on this computer.
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {/* Left: the comparison workflow */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <UploadCard
                  title={`Original ${cfg.name}`}
                  description={`Upload the original ${cfg.name} file.`}
                  value={s.original}
                  onFile={(f) => s.loadFile('original', f)}
                  onRemove={() => s.clearFile('original')}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <UploadCard
                  title={`Modified ${cfg.name}`}
                  description={`Upload the modified ${cfg.name} file.`}
                  value={s.modified}
                  onFile={(f) => s.loadFile('modified', f)}
                  onRemove={() => s.clearFile('modified')}
                />
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, mt: -1 }}>
              <Button
                variant="outlined"
                startIcon={<SwapHorizIcon />}
                onClick={s.swapFiles}
                disabled={(!s.original && !s.modified) || s.loading}
              >
                Swap Original &amp; Modified
              </Button>
            </Box>

            <OptionsPanel value={s.options} onChange={s.setOptions} />

            {s.error && (
              <Alert severity="error" sx={{ mt: 3 }}>
                {s.error}
              </Alert>
            )}

            {/* Sticky so Compare is always fully visible, however tall the page is. */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{
                mt: 2,
                py: 1.5,
                position: 'sticky',
                bottom: 0,
                zIndex: 2,
                bgcolor: 'background.default',
                borderTop: 1,
                borderColor: 'divider',
                alignItems: { sm: 'center' },
              }}
            >
              <Button
                variant="contained"
                size="large"
                disabled={!ready || s.loading}
                onClick={onCompare}
                startIcon={
                  s.loading ? <CircularProgress size={18} color="inherit" /> : <CompareArrowsIcon />
                }
              >
                {s.loading ? 'Comparing…' : `Compare ${cfg.name} Files`}
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<RestartAltIcon />}
                onClick={s.reset}
                disabled={s.loading}
              >
                Reset
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                startIcon={<ScienceOutlinedIcon />}
                onClick={loadSamples}
                disabled={s.loading}
              >
                Load sample files
              </Button>
            </Stack>
          </Grid>

          {/* Right: history (below the workflow on narrow screens) */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Box sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
              <HistorySection
                entries={s.history}
                onRemove={s.removeHistory}
                onClear={s.clearHistory}
                busy={s.loading}
                onReopen={async (id) => {
                  if (await s.reopenHistory(id)) navigate(`${cfg.base}/results`);
                }}
              />
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
