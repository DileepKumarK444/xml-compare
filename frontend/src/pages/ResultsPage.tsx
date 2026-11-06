import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ListAltIcon from '@mui/icons-material/ListAlt';
import {
  Box,
  Button,
  Collapse,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import ContentView from '../components/ContentView';
import DifferencesPanel from '../components/DifferencesPanel';
import SourceView from '../components/SourceView';
import SummaryCards from '../components/SummaryCards';
import { useAppState } from '../state/AppState';
import type { PanelDifference, ViewMode } from '../types';

export default function ResultsPage() {
  const { result, view, setView, selectDifference, recompareModified } = useAppState();
  const navigate = useNavigate();
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('lg'));
  const [panelOverride, setPanelOverride] = useState<boolean | null>(null);
  const panelOpen = panelOverride ?? wide; // open by default on wide screens, collapsed on small ones

  const tab = view.tab;
  const filter = view.filter;
  const selectedId = view.selected[tab];

  const sourceVisible = useMemo(
    () => (result?.source.differences ?? []).filter((d) => filter === 'all' || d.type === filter),
    [result, filter],
  );
  const contentVisible = useMemo(
    () => (result?.content.differences ?? []).filter((d) => filter === 'all' || d.type === filter),
    [result, filter],
  );
  if (!result) return null;

  const mode = tab === 'source' ? result.source : result.content;
  const total = mode.differences.length;
  const panelItems: PanelDifference[] = (tab === 'source' ? sourceVisible : contentVisible).map(
    (d) => ({
      id: d.id,
      type: d.type,
      description: d.description,
      path:
        tab === 'source'
          ? sourceLabel(d as (typeof sourceVisible)[number])
          : (d as (typeof contentVisible)[number]).path,
    }),
  );

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <AppHeader>
        <Button
          color="inherit"
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/xml-compare')}
          sx={{ border: '1px solid rgba(255,255,255,0.3)' }}
        >
          Back to Upload
        </Button>
        <Typography noWrap sx={{ fontSize: 14, opacity: 0.9, minWidth: 0 }}>
          <b>Original:</b> {result.original.filename} &nbsp;↔&nbsp; <b>Modified:</b>{' '}
          {result.modified.filename}
        </Typography>
      </AppHeader>

      <Box
        sx={{
          px: { xs: 2, md: 3 },
          pt: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          flex: 1,
          minHeight: 0,
        }}
      >
        <SummaryCards
          summary={mode.summary}
          unit={tab === 'source' ? 'lines' : 'elements'}
          filter={filter}
          onFilter={(f) => setView({ filter: f })}
        />

        <Box
          sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}
        >
          <Tabs value={tab} onChange={(_, v: ViewMode) => setView({ tab: v })} sx={{ flex: 1 }}>
            <Tab value="source" label="XML Source View" />
            <Tab value="content" label="XML Content View" />
          </Tabs>
          {!wide && (
            <Button
              size="small"
              startIcon={<ListAltIcon />}
              onClick={() => setPanelOverride(!panelOpen)}
            >
              {panelOpen ? 'Hide' : 'Show'} differences
            </Button>
          )}
        </Box>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            gap: 1.5,
            pb: 2,
            overflow: { xs: 'auto', lg: 'hidden' },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0, minHeight: { xs: 560, lg: 0 } }}>
            {/* Both views stay mounted so scroll/expansion state survives tab switches. */}
            <Box sx={{ height: '100%', display: tab === 'source' ? 'block' : 'none' }}>
              <SourceView
                result={result}
                visible={sourceVisible}
                selectedId={view.selected.source}
                onSelect={(id) => selectDifference(id)}
                onEdit={recompareModified}
              />
            </Box>
            <Box sx={{ height: '100%', display: tab === 'content' ? 'block' : 'none' }}>
              <ContentView
                result={result}
                visible={contentVisible}
                filter={filter}
                selectedId={view.selected.content}
                onSelect={(id) => selectDifference(id)}
              />
            </Box>
          </Box>
          <Collapse
            in={panelOpen}
            orientation={wide ? 'horizontal' : 'vertical'}
            unmountOnExit={false}
          >
            <Box sx={{ width: { xs: '100%', lg: 340 }, height: { xs: 320, lg: '100%' } }}>
              <DifferencesPanel
                differences={panelItems}
                total={total}
                selectedId={selectedId}
                filter={filter}
                onFilter={(f) => setView({ filter: f })}
                onSelect={(id) => selectDifference(id)}
              />
            </Box>
          </Collapse>
        </Box>
      </Box>
    </Box>
  );
}

function sourceLabel(d: {
  original_start: number | null;
  original_end: number | null;
  modified_start: number | null;
  modified_end: number | null;
}) {
  const r = (a: number | null, b: number | null) =>
    a == null ? '' : a === b ? `${a}` : `${a}–${b}`;
  const o = r(d.original_start, d.original_end);
  const m = r(d.modified_start, d.modified_end);
  return [o && `Original line ${o}`, m && `Modified line ${m}`].filter(Boolean).join(' · ');
}
