import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

export default function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>About XML Compare</DialogTitle>
      <DialogContent dividers>
        <Typography gutterBottom>
          XML Compare runs entirely on this machine. Files are processed in memory and are never
          stored or sent to the internet. Only a short history (file names and counts) is kept in
          this browser.
        </Typography>
        <Typography variant="subtitle2" sx={{ mt: 2 }}>
          XML Source View
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Compares the raw XML text line by line, exactly as written. Your files are never
          reformatted.
        </Typography>
        <Typography variant="subtitle2">XML Content View</Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Compares the parsed structure: elements, attributes, text values, namespaces and ordering,
          ignoring formatting-only differences.
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
