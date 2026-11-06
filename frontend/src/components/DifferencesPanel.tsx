import {
  Box,
  Chip,
  List,
  ListItemButton,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useEffect, useRef } from 'react';
import { statusColors } from '../theme';
import type { DiffFilter, PanelDifference } from '../types';

interface Props {
  differences: PanelDifference[]; // already filtered
  total: number;
  selectedId: number | null;
  filter: DiffFilter;
  onFilter: (f: DiffFilter) => void;
  onSelect: (id: number) => void;
}

const FILTERS: DiffFilter[] = ['all', 'added', 'removed', 'modified'];

export default function DifferencesPanel({
  differences,
  total,
  selectedId,
  filter,
  onFilter,
  onSelect,
}: Props) {
  const selectedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  return (
    <Paper
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderRadius: 3,
      }}
    >
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          Differences{' '}
          <Typography component="span" color="text.secondary">
            ({differences.length}
            {filter !== 'all' ? ` of ${total}` : ''})
          </Typography>
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          fullWidth
          value={filter}
          onChange={(_, v) => v && onFilter(v)}
          aria-label="Filter differences"
        >
          {FILTERS.map((f) => (
            <ToggleButton key={f} value={f} sx={{ textTransform: 'capitalize', py: 0.25 }}>
              {f}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <List dense disablePadding sx={{ overflow: 'auto', flex: 1 }}>
        {differences.length === 0 && (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            No differences to show.
          </Typography>
        )}
        {differences.map((d, i) => {
          const c = statusColors[d.type];
          const selected = d.id === selectedId;
          return (
            <ListItemButton
              key={d.id}
              ref={selected ? selectedRef : undefined}
              selected={selected}
              onClick={() => onSelect(d.id)}
              sx={{
                display: 'block',
                borderLeft: 4,
                borderColor: c.main,
                py: 1,
                '&.Mui-selected': {
                  bgcolor: c.bg,
                  outline: `2px solid ${c.main}`,
                  outlineOffset: -2,
                },
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.25 }}>
                <Typography variant="caption" color="text.secondary">
                  #{i + 1}
                </Typography>
                <Chip
                  size="small"
                  label={c.label}
                  sx={{ height: 20, bgcolor: c.bg, color: c.main, fontWeight: 600 }}
                />
              </Stack>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: 12,
                  wordBreak: 'break-all',
                }}
              >
                {d.path}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', wordBreak: 'break-word' }}
              >
                {d.description}
              </Typography>
            </ListItemButton>
          );
        })}
      </List>
    </Paper>
  );
}
