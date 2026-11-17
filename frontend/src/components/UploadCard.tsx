import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import ErrorIcon from '@mui/icons-material/Error';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { useRef, useState, type DragEvent } from 'react';
import type { SelectedFile } from '../state/AppState';
import { useFormat } from '../formats';
import { formatBytes } from '../utils/format';

interface Props {
  title: string;
  description: string;
  value: SelectedFile | null;
  onFile: (file: File) => void;
  onRemove: () => void;
  /** Override the page's format, e.g. an optional XSD card on the XML Validator. */
  kind?: { name: string; accept: string; extLabel: string };
}

export default function UploadCard({ title, description, value, onFile, onRemove, kind }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const fmt = useFormat();
  const cfg = kind ?? { name: fmt.name, accept: fmt.accept, extLabel: fmt.extLabel };
  const id = title.replace(/\s+/g, '-').toLowerCase();

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
        <Box>
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>

        <Box
          data-testid={`${id}-dropzone`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          sx={{
            flex: 1,
            minHeight: 150,
            border: '2px dashed',
            borderRadius: 2,
            p: 2,
            borderColor: drag ? 'primary.main' : value?.error ? 'error.light' : 'divider',
            bgcolor: drag ? 'rgba(21,101,192,0.05)' : '#fafcff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            textAlign: 'center',
          }}
        >
          {value ? (
            <Stack spacing={0.75} sx={{ width: '100%', alignItems: 'center' }}>
              <InsertDriveFileOutlinedIcon
                color={value.error ? 'error' : 'primary'}
                sx={{ fontSize: 36 }}
              />
              <Typography
                sx={{ fontWeight: 600, wordBreak: 'break-all' }}
                data-testid={`${id}-filename`}
              >
                {value.file.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatBytes(value.file.size)}
              </Typography>
              {value.error ? (
                <Chip
                  size="small"
                  color="error"
                  icon={<ErrorIcon />}
                  label={`Invalid ${cfg.name}`}
                />
              ) : (
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  icon={<CheckCircleIcon />}
                  label={`Valid ${cfg.name}`}
                />
              )}
              {value.error && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ maxWidth: '100%', wordBreak: 'break-word' }}
                >
                  {value.error}
                </Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
                <Button size="small" variant="outlined" onClick={() => input.current?.click()}>
                  Replace
                </Button>
                <Button size="small" color="inherit" onClick={onRemove}>
                  Remove
                </Button>
              </Stack>
            </Stack>
          ) : (
            <>
              <CloudUploadOutlinedIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              <Typography>
                Drag &amp; drop {cfg.name === 'XML' ? 'an' : 'a'} {cfg.name} file here
              </Typography>
              <Typography variant="caption" color="text.secondary">
                or
              </Typography>
              <Button variant="contained" onClick={() => input.current?.click()}>
                Browse File
              </Button>
              <Typography variant="caption" color="text.secondary">
                Accepted format: {cfg.extLabel}
              </Typography>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept={cfg.accept || undefined}
            hidden
            aria-label={`${title} file`}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}
