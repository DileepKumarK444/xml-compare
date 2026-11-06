import { Box, Typography } from '@mui/material';
import { statusColors } from '../theme';

function Title({ label, name, color }: { label: string; name: string; color: string }) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.75,
      }}
    >
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flex: '0 0 auto' }} />
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography noWrap title={name} sx={{ fontWeight: 600, fontSize: 14 }}>
        {name}
      </Typography>
    </Box>
  );
}

/** Headings naming the two files; used above the source diff and the content tree. */
export default function FileTitles({ original, modified }: { original: string; modified: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        border: 1,
        borderColor: 'divider',
        borderRadius: 3,
        bgcolor: '#eef3fa',
      }}
    >
      <Title label="Original" name={original} color={statusColors.removed.main} />
      <Box sx={{ width: '1px', bgcolor: 'divider' }} />
      <Title label="Modified" name={modified} color={statusColors.added.main} />
    </Box>
  );
}
