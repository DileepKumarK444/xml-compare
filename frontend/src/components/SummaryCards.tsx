import { Box, Card, Typography } from '@mui/material';
import { statusColors } from '../theme';
import type { DiffFilter, Summary } from '../types';

interface Props {
  summary: Summary;
  unit: string;
  filter: DiffFilter;
  onFilter: (f: DiffFilter) => void;
}

export default function SummaryCards({ summary, unit, filter, onFilter }: Props) {
  const items: {
    key: DiffFilter | 'unchanged';
    label: string;
    value: number;
    color: string;
    bg: string;
  }[] = [
    {
      key: 'all',
      label: 'Total Differences',
      value: summary.total,
      color: '#0b2a4f',
      bg: '#e8f0fb',
    },
    {
      key: 'added',
      label: 'Added',
      value: summary.added,
      color: statusColors.added.main,
      bg: statusColors.added.bg,
    },
    {
      key: 'removed',
      label: 'Removed',
      value: summary.removed,
      color: statusColors.removed.main,
      bg: statusColors.removed.bg,
    },
    {
      key: 'modified',
      label: 'Modified',
      value: summary.modified,
      color: statusColors.modified.main,
      bg: statusColors.modified.bg,
    },
    {
      key: 'unchanged',
      label: `Unchanged ${unit}`,
      value: summary.unchanged,
      color: statusColors.unchanged.main,
      bg: statusColors.unchanged.bg,
    },
  ];
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
      }}
    >
      {items.map((it) => {
        const clickable = it.key !== 'unchanged';
        const active = clickable && filter === it.key;
        return (
          <Card
            key={it.key}
            onClick={clickable ? () => onFilter(it.key as DiffFilter) : undefined}
            role={clickable ? 'button' : undefined}
            sx={{
              px: 2,
              py: 1.25,
              bgcolor: it.bg,
              borderColor: active ? it.color : 'transparent',
              borderWidth: 2,
              borderStyle: 'solid',
              cursor: clickable ? 'pointer' : 'default',
            }}
          >
            <Typography variant="caption" sx={{ color: it.color, fontWeight: 600 }}>
              {it.label}
            </Typography>
            <Typography
              variant="h5"
              sx={{ color: it.color, lineHeight: 1.2 }}
              data-testid={`summary-${it.key}`}
            >
              {it.value}
            </Typography>
          </Card>
        );
      })}
    </Box>
  );
}
