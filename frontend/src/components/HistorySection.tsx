import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import HistoryIcon from '@mui/icons-material/History';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { formatBytes } from '../utils/format';
import type { HistoryEntry } from '../utils/history';

interface Props {
  entries: HistoryEntry[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onReopen: (id: string) => void;
  busy?: boolean;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function optionLabels(o: HistoryEntry['options']): string {
  const on = [
    o.ignore_whitespace && 'whitespace',
    o.ignore_comments && 'comments',
    o.ignore_order && 'order',
  ].filter(Boolean);
  return on.length ? `Ignored: ${on.join(', ')}` : 'No options';
}

function Counts({ label, s }: { label: string; s: HistoryEntry['source'] }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ width: 52 }}>
        {label}
      </Typography>
      {s.total === 0 ? (
        <Chip size="small" color="success" variant="outlined" label="Identical" />
      ) : (
        <>
          <Chip size="small" label={`${s.total} total`} />
          {s.added > 0 && <Chip size="small" color="success" label={`+${s.added}`} />}
          {s.removed > 0 && <Chip size="small" color="error" label={`−${s.removed}`} />}
          {s.modified > 0 && <Chip size="small" color="warning" label={`~${s.modified}`} />}
        </>
      )}
    </Stack>
  );
}

export default function HistorySection({ entries, onRemove, onClear, onReopen, busy }: Props) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
        <HistoryIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h3" sx={{ flex: 1 }}>
          Comparison history
        </Typography>
        {entries.length > 0 && (
          <Button size="small" color="error" onClick={onClear}>
            Clear
          </Button>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Saved in this browser only. The files are kept so you can re-open any comparison; removing
        an entry deletes them.
      </Typography>

      {entries.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
          No comparisons yet. Files you compare will be listed here.
        </Box>
      ) : (
        <Box sx={{ maxHeight: { lg: 'calc(100vh - 240px)' }, overflowY: 'auto', pr: 0.5 }}>
          {entries.map((e, i) => (
            <Box key={e.id}>
              {i > 0 && <Divider sx={{ my: 1.5 }} />}
              <Typography variant="caption" color="text.secondary">
                {when(e.at)}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-all' }}>
                {e.original.name}{' '}
                <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                  ({formatBytes(e.original.size)})
                </Box>
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-all' }}>
                ↔ {e.modified.name}{' '}
                <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                  ({formatBytes(e.modified.size)})
                </Box>
              </Typography>
              <Box sx={{ my: 0.75 }}>
                <Counts label="Source" s={e.source} />
                <Counts label="Content" s={e.content} />
              </Box>
              <Stack direction="row" sx={{ alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                  {optionLabels(e.options)}
                </Typography>
                <Tooltip title={e.stored ? 'Open this comparison again' : 'Files were not saved'}>
                  <span>
                    <Button
                      size="small"
                      startIcon={<OpenInNewIcon />}
                      disabled={!e.stored || busy}
                      onClick={() => onReopen(e.id)}
                    >
                      Re-open
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Remove from history">
                  <IconButton size="small" aria-label="Remove" onClick={() => onRemove(e.id)}>
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}
