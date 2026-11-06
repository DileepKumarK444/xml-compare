import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import HistoryIcon from '@mui/icons-material/History';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import type { HistoryEntry } from '../utils/history';
import { formatBytes } from '../utils/format';

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
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
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
    <Paper variant="outlined" sx={{ mt: 4, p: 2.5, borderRadius: 3 }}>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
        <HistoryIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h3" sx={{ flex: 1 }}>
          Comparison history
        </Typography>
        {entries.length > 0 && (
          <Button size="small" color="error" onClick={onClear}>
            Clear history
          </Button>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Saved in this browser only (nothing is sent anywhere). The files themselves are kept so you
        can re-open any comparison; remove an entry or clear the history to delete them.
      </Typography>

      {entries.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
          No comparisons yet. Files you compare will be listed here.
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto', maxHeight: 360 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Original</TableCell>
                <TableCell>Modified</TableCell>
                <TableCell>Differences</TableCell>
                <TableCell>Options</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{when(e.at)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {e.original.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatBytes(e.original.size)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {e.modified.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatBytes(e.modified.size)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Counts label="Source" s={e.source} />
                    <Counts label="Content" s={e.content} />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{optionLabels(e.options)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip
                      title={e.stored ? 'Open this comparison again' : 'Files were not saved'}
                    >
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Paper>
  );
}
