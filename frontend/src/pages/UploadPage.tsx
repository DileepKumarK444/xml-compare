import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import { Alert, Box, Button, CircularProgress, Container, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import OptionsPanel from '../components/OptionsPanel';
import UploadCard from '../components/UploadCard';
import originalSample from '../mock/original.xml?raw';
import modifiedSample from '../mock/modified.xml?raw';
import { useAppState } from '../state/AppState';

export default function UploadPage() {
  const s = useAppState();
  const navigate = useNavigate();
  const ready = !!s.original && !!s.modified && !s.original.error && !s.modified.error;

  const onCompare = async () => {
    if (await s.compare()) navigate('/results');
  };
  const loadSamples = async () => {
    await s.loadFile('original', new File([originalSample], 'original.xml', { type: 'text/xml' }));
    await s.loadFile('modified', new File([modifiedSample], 'modified.xml', { type: 'text/xml' }));
  };

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppHeader />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Compare two XML files
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          1. Upload both files &nbsp;›&nbsp; 2. Choose options and compare &nbsp;›&nbsp; 3. Review
          the differences. Everything stays on this computer.
        </Typography>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <UploadCard
              title="Original XML"
              description="Upload the original XML file."
              value={s.original}
              onFile={(f) => s.loadFile('original', f)}
              onRemove={() => s.clearFile('original')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <UploadCard
              title="Modified XML"
              description="Upload the modified XML file."
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

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ mt: 3, alignItems: { sm: 'center' } }}
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
            {s.loading ? 'Comparing…' : 'Compare XML Files'}
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
      </Container>
    </Box>
  );
}
