import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { Button, Stack, Typography } from '@mui/material';

interface Props {
  ids: number[]; // visible (filtered) difference ids, in order
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function DiffNav({ ids, selectedId, onSelect }: Props) {
  const idx = selectedId == null ? -1 : ids.indexOf(selectedId);
  const go = (delta: number) => {
    if (!ids.length) return;
    const next =
      idx === -1 ? (delta > 0 ? 0 : ids.length - 1) : (idx + delta + ids.length) % ids.length;
    onSelect(ids[next]);
  };
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Button
        size="small"
        variant="outlined"
        startIcon={<ArrowUpwardIcon />}
        onClick={() => go(-1)}
        disabled={!ids.length}
      >
        Previous Difference
      </Button>
      <Button
        size="small"
        variant="outlined"
        endIcon={<ArrowDownwardIcon />}
        onClick={() => go(1)}
        disabled={!ids.length}
      >
        Next Difference
      </Button>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: 110 }}
        data-testid="diff-counter"
      >
        {ids.length
          ? `Difference ${idx === -1 ? '–' : idx + 1} of ${ids.length}`
          : 'No differences'}
      </Typography>
    </Stack>
  );
}
