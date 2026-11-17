import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useFormat } from '../formats';

export interface About {
  title: string;
  paragraphs: string[];
}

export default function HelpDialog({
  open,
  onClose,
  about,
}: {
  open: boolean;
  onClose: () => void;
  about?: About;
}) {
  const cfg = useFormat();
  if (about) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{about.title}</DialogTitle>
        <DialogContent dividers>
          {about.paragraphs.map((p) => (
            <Typography key={p} gutterBottom>
              {p}
            </Typography>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>About {cfg.tool}</DialogTitle>
      <DialogContent dividers>
        <Typography gutterBottom>
          {cfg.tool} runs entirely on this machine. Files are processed in memory and are never
          stored or sent to the internet. A history of past comparisons, including the files, is
          kept in this browser only so you can re-open them.
        </Typography>
        <Typography variant="subtitle2" sx={{ mt: 2 }}>
          {cfg.name} Source View
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {cfg.help.source}
        </Typography>
        <Typography variant="subtitle2">{cfg.name} Content View</Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {cfg.help.content}
        </Typography>
        <Typography variant="subtitle2">Colours</Typography>
        <Typography variant="body2" color="text.secondary">
          Green = added · Red = removed · Yellow = modified · Grey = unchanged.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
